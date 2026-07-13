import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import ProductionOrder from './production-order.model'
import ProductionOrderLine from './production-order-line.model'
import BillOfMaterials from './bom.model'
import BomItem from './bom-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import Warehouse from '@/modules/inventory/warehouse.model'
import { ensureProductionAssociations } from './production-associations'
import { nextProductionOrderNumber, computeBomRollupCost } from './production.utils'
import { getActiveBomForVariant } from './boms.service'
import type {
  ProductionOrderInput,
  ProductionOrderUpdateInput,
  ProductionOrderQuery,
  CompleteProductionOrderInput,
} from './production-order.schema'

export async function listProductionOrders(query: ProductionOrderQuery, orgId: string) {
  ensureProductionAssociations()

  const { page, limit, search, status, branch_id, variant_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)     where.status     = status
  if (branch_id)  where.branch_id  = branch_id
  if (variant_id) where.variant_id = variant_id
  if (search) {
    where[Op.or as unknown as string] = [{ order_number: { [Op.iLike]: `%${search}%` } }]
  }

  const { default: Branch } = await import('@/modules/auth/branch.model')

  const { rows, count } = await ProductionOrder.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'name'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getProductionOrder(id: string, orgId: string) {
  ensureProductionAssociations()

  const { default: Branch } = await import('@/modules/auth/branch.model')

  const order = await ProductionOrder.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: BillOfMaterials, as: 'bom', attributes: ['id', 'name', 'output_quantity'] },
      {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'name', 'cost_price'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'], required: false },
      {
        model: ProductionOrderLine,
        as: 'lines',
        order: [['sort_order', 'ASC']],
        include: [
          {
            model: ProductVariant,
            as: 'component',
            attributes: ['id', 'sku', 'name'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
          },
        ],
      },
    ],
  })
  if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
  return order
}

function scaledLineQuantity(itemQuantity: string, itemScrapPct: string, scale: Decimal): string {
  const qty   = new Decimal(itemQuantity)
  const scrap = new Decimal(itemScrapPct).div(100)
  return qty.mul(new Decimal(1).plus(scrap)).mul(scale).toFixed(4)
}

export async function createProductionOrder(input: ProductionOrderInput, orgId: string, actorId: string) {
  const orderId = await sequelize.transaction(async (t) => {
    const bom = (input.bom_id
      ? await BillOfMaterials.findOne({
          where: { id: input.bom_id, org_id: orgId },
          include: [{ model: BomItem, as: 'items' }],
          transaction: t,
        })
      : await getActiveBomForVariant(input.variant_id!, orgId, t)) as (BillOfMaterials & { items: BomItem[] }) | null

    if (!bom) throw new Error('BOM_NOT_FOUND')
    const items = bom.items ?? []
    if (items.length === 0) throw new Error('BOM_EMPTY')

    const orderNumber = await nextProductionOrderNumber(orgId, input.branch_id, t)
    const scale = new Decimal(input.planned_quantity).div(new Decimal(bom.output_quantity))

    const order = await ProductionOrder.create(
      {
        branch_id:         input.branch_id,
        warehouse_id:      input.warehouse_id ?? null,
        order_number:      orderNumber,
        bom_id:            bom.id,
        variant_id:        bom.variant_id,
        status:            'draft',
        planned_quantity:  String(input.planned_quantity),
        scheduled_date:    input.scheduled_date ?? null,
        notes:             input.notes ?? null,
        org_id:            orgId,
        created_by:        actorId,
        updated_by:        actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      items.map((item, idx) =>
        ProductionOrderLine.create(
          {
            order_id:              order.id,
            component_variant_id: item.component_variant_id,
            planned_quantity:      scaledLineQuantity(item.quantity, item.scrap_pct, scale),
            sort_order:            item.sort_order ?? idx,
            org_id:                orgId,
            created_by:            actorId,
            updated_by:            actorId,
          },
          { transaction: t },
        ),
      ),
    )

    logger.info({ orderId: order.id, orgId, number: orderNumber }, 'production order created')
    return order.id
  })
  return getProductionOrder(orderId, orgId)
}

export async function updateProductionOrder(id: string, input: ProductionOrderUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (order.status !== 'draft') throw new Error('PRODUCTION_ORDER_NOT_DRAFT')

    if (input.planned_quantity !== undefined) {
      const bom = await BillOfMaterials.findOne({
        where: { id: order.bom_id },
        include: [{ model: BomItem, as: 'items' }],
        transaction: t,
      }) as (BillOfMaterials & { items: BomItem[] }) | null
      if (!bom) throw new Error('BOM_NOT_FOUND')
      const items = bom.items ?? []
      const scale = new Decimal(input.planned_quantity).div(new Decimal(bom.output_quantity))

      await ProductionOrderLine.destroy({ where: { order_id: id }, transaction: t })
      await Promise.all(
        items.map((item, idx) =>
          ProductionOrderLine.create(
            {
              order_id:              id,
              component_variant_id: item.component_variant_id,
              planned_quantity:      scaledLineQuantity(item.quantity, item.scrap_pct, scale),
              sort_order:            item.sort_order ?? idx,
              org_id:                orgId,
              created_by:            actorId,
              updated_by:            actorId,
            },
            { transaction: t },
          ),
        ),
      )
    }

    const { planned_quantity, ...rest } = input
    await order.update(
      {
        ...rest,
        ...(planned_quantity !== undefined ? { planned_quantity: String(planned_quantity) } : {}),
        updated_by: actorId,
      },
      { transaction: t },
    )
    return order
  })
}

export async function deleteProductionOrder(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (order.status !== 'draft') throw new Error('PRODUCTION_ORDER_NOT_DRAFT')

    await order.update({ deleted_by: actorId }, { transaction: t })
    await order.destroy({ transaction: t })
  })
}

/** draft → released: consume components via applyMovement (OUT), FEFO automático. */
export async function releaseProductionOrder(id: string, orgId: string, actorId: string) {
  await sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (order.status !== 'draft') throw new Error('PRODUCTION_ORDER_INVALID_STATUS')
    if (!order.warehouse_id) throw new Error('PRODUCTION_ORDER_NO_WAREHOUSE')

    const lines = await ProductionOrderLine.findAll({ where: { order_id: id }, transaction: t })
    const { applyMovement } = await import('@/modules/inventory/stock-movements.service')

    for (const line of lines) {
      await applyMovement(
        {
          variantId:     line.component_variant_id,
          warehouseId:   order.warehouse_id,
          orgId,
          movementType:  'out',
          referenceType: 'production_order',
          referenceId:   order.id,
          quantityDelta: new Decimal(line.planned_quantity).negated(),
          notes:         `Consumo OP ${order.order_number}`,
          actorId,
        },
        t,
      )
      await line.update({ consumed_quantity: line.planned_quantity }, { transaction: t })
    }

    await order.update({ status: 'released', released_at: new Date(), updated_by: actorId }, { transaction: t })
    logger.info({ orderId: id, orgId }, 'production order released — components consumed')
  })
  return getProductionOrder(id, orgId)
}

/** released → in_process: solo marca de estado (sin efecto de stock, para producción parcial futura). */
export async function startProductionOrder(id: string, orgId: string, actorId: string) {
  await sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (order.status !== 'released') throw new Error('PRODUCTION_ORDER_INVALID_STATUS')

    await order.update({ status: 'in_process', started_at: new Date(), updated_by: actorId }, { transaction: t })
  })
  return getProductionOrder(id, orgId)
}

/** released|in_process → done: ingresa producto terminado vía applyMovement (IN) y recalcula el costo. */
export async function completeProductionOrder(
  id: string,
  input: CompleteProductionOrderInput,
  orgId: string,
  actorId: string,
) {
  await sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (!['released', 'in_process'].includes(order.status)) throw new Error('PRODUCTION_ORDER_INVALID_STATUS')
    if (!order.warehouse_id) throw new Error('PRODUCTION_ORDER_NO_WAREHOUSE')

    const producedQuantity = new Decimal(input.produced_quantity ?? order.planned_quantity)

    const { applyMovement } = await import('@/modules/inventory/stock-movements.service')
    await applyMovement(
      {
        variantId:     order.variant_id,
        warehouseId:   order.warehouse_id,
        orgId,
        movementType:  'in',
        referenceType: 'production_order',
        referenceId:   order.id,
        quantityDelta: producedQuantity,
        notes:         `Producción terminada OP ${order.order_number}`,
        actorId,
      },
      t,
    )

    const bom = await BillOfMaterials.findOne({
      where: { id: order.bom_id },
      include: [{ model: BomItem, as: 'items', include: [{ model: ProductVariant, as: 'component', attributes: ['cost_price'] }] }],
      transaction: t,
    }) as (BillOfMaterials & { items: Array<BomItem & { component?: { cost_price: string | null } }> }) | null
    if (bom) {
      const items = bom.items ?? []
      const unitCost = computeBomRollupCost(
        items.map(i => ({ quantity: i.quantity, scrap_pct: i.scrap_pct, cost_price: i.component?.cost_price ?? null })),
        bom.output_quantity,
      )
      await ProductVariant.update(
        { cost_price: unitCost.toFixed(2) },
        { where: { id: order.variant_id }, transaction: t },
      )
    }

    await order.update(
      {
        status:             'done',
        produced_quantity:  producedQuantity.toFixed(4),
        completed_at:       new Date(),
        updated_by:         actorId,
      },
      { transaction: t },
    )

    logger.info({ orderId: id, orgId }, 'production order completed — finished goods added')
  })
  return getProductionOrder(id, orgId)
}

/** draft → cancelled: no-op de stock. released|in_process → cancelled: revierte el consumo. */
export async function cancelProductionOrder(id: string, orgId: string, actorId: string) {
  await sequelize.transaction(async (t) => {
    const order = await ProductionOrder.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND')
    if (['done', 'cancelled'].includes(order.status)) throw new Error('PRODUCTION_ORDER_INVALID_STATUS')

    if (order.status !== 'draft') {
      const { default: StockMovement } = await import('@/modules/inventory/stock-movement.model')
      const { applyMovement } = await import('@/modules/inventory/stock-movements.service')

      const movements = await StockMovement.findAll({
        where: { reference_type: 'production_order', reference_id: id, movement_type: 'out', org_id: orgId },
        transaction: t,
      })

      for (const mv of movements) {
        await applyMovement(
          {
            variantId:     mv.variant_id,
            warehouseId:   mv.warehouse_id,
            orgId,
            movementType:  'in',
            referenceType: 'production_order',
            referenceId:   id,
            quantityDelta: new Decimal(mv.quantity_delta).abs(),
            notes:         `Reversión por cancelación OP ${order.order_number}`,
            actorId,
          },
          t,
        )
      }
    }

    await order.update({ status: 'cancelled', cancelled_at: new Date(), updated_by: actorId }, { transaction: t })
    logger.info({ orderId: id, orgId }, 'production order cancelled')
  })
  return getProductionOrder(id, orgId)
}
