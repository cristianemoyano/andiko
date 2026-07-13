import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import BillOfMaterials from './bom.model'
import BomItem from './bom-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import type { BomInput, BomReplaceInput, BomQuery } from './bom.schema'

const ITEM_INCLUDE = [
  {
    model: BomItem,
    as: 'items',
    include: [
      {
        model: ProductVariant,
        as: 'component',
        attributes: ['id', 'sku', 'name', 'cost_price'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  },
  {
    model: ProductVariant,
    as: 'variant',
    attributes: ['id', 'sku', 'name'],
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'production_type'] }],
  },
]

export async function listBoms(query: BomQuery, orgId: string) {
  const { page, limit, variant_id, is_active, search } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (variant_id) where.variant_id = variant_id
  if (is_active !== undefined) where.is_active = is_active
  if (search) {
    where[Op.or as unknown as string] = [{ name: { [Op.iLike]: `%${search}%` } }]
  }

  const { rows, count } = await BillOfMaterials.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'name'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
      { model: BomItem, as: 'items', attributes: ['id'] },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getBom(id: string, orgId: string) {
  const bom = await BillOfMaterials.findOne({ where: { id, org_id: orgId }, include: ITEM_INCLUDE })
  if (!bom) throw new Error('BOM_NOT_FOUND')
  return bom
}

export async function getActiveBomForVariant(variantId: string, orgId: string, t?: Transaction) {
  return BillOfMaterials.findOne({
    where: { variant_id: variantId, org_id: orgId, is_active: true },
    include: [{ model: BomItem, as: 'items' }],
    transaction: t,
  })
}

export async function createBom(input: BomInput, orgId: string, actorId: string) {
  if (input.items.some(i => i.component_variant_id === input.variant_id)) {
    throw new Error('BOM_SELF_REFERENCE')
  }

  const bomId = await sequelize.transaction(async (t) => {
    const existing = await BillOfMaterials.findOne({
      where: { variant_id: input.variant_id, org_id: orgId, is_active: true },
      transaction: t,
    })
    if (existing) throw new Error('BOM_ALREADY_ACTIVE')

    const bom = await BillOfMaterials.create(
      {
        variant_id:      input.variant_id,
        name:            input.name,
        output_quantity: String(input.output_quantity),
        is_active:       true,
        notes:           input.notes ?? null,
        org_id:          orgId,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      input.items.map((item, idx) =>
        BomItem.create(
          {
            bom_id:                bom.id,
            component_variant_id: item.component_variant_id,
            quantity:              String(item.quantity),
            scrap_pct:             String(item.scrap_pct),
            sort_order:            item.sort_order ?? idx,
            notes:                 item.notes ?? null,
            org_id:                orgId,
            created_by:            actorId,
            updated_by:            actorId,
          },
          { transaction: t },
        ),
      ),
    )

    return bom.id
  })
  return getBom(bomId, orgId)
}

/** "Editar" una BOM: desactiva la actual y crea una nueva activa (nunca se muta una BOM en uso). */
export async function replaceBom(id: string, input: BomReplaceInput, orgId: string, actorId: string) {
  const nextId = await sequelize.transaction(async (t) => {
    const current = await BillOfMaterials.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!current) throw new Error('BOM_NOT_FOUND')

    if (input.items.some(i => i.component_variant_id === current.variant_id)) {
      throw new Error('BOM_SELF_REFERENCE')
    }

    await current.update({ is_active: false, updated_by: actorId }, { transaction: t })

    const next = await BillOfMaterials.create(
      {
        variant_id:      current.variant_id,
        name:            input.name ?? current.name,
        output_quantity: input.output_quantity !== undefined ? String(input.output_quantity) : current.output_quantity,
        is_active:       true,
        notes:           input.notes !== undefined ? input.notes : current.notes,
        org_id:          orgId,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      input.items.map((item, idx) =>
        BomItem.create(
          {
            bom_id:                next.id,
            component_variant_id: item.component_variant_id,
            quantity:              String(item.quantity),
            scrap_pct:             String(item.scrap_pct),
            sort_order:            item.sort_order ?? idx,
            notes:                 item.notes ?? null,
            org_id:                orgId,
            created_by:            actorId,
            updated_by:            actorId,
          },
          { transaction: t },
        ),
      ),
    )

    return next.id
  })
  return getBom(nextId, orgId)
}

export async function deactivateBom(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const bom = await BillOfMaterials.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!bom) throw new Error('BOM_NOT_FOUND')

    const { default: ProductionOrder } = await import('./production-order.model')
    const inUse = await ProductionOrder.count({
      where: { bom_id: id, org_id: orgId, status: { [Op.in]: ['draft', 'released', 'in_process'] } },
      transaction: t,
    })
    if (inUse > 0) throw new Error('BOM_IN_USE')

    await bom.update({ is_active: false, deleted_by: actorId }, { transaction: t })
    await bom.destroy({ transaction: t })
  })
}
