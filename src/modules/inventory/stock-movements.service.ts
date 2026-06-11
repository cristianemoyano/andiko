import 'server-only'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { paginate, toPaginated } from '@/lib/pagination'
import StockItem from './stock-item.model'
import StockMovement from './stock-movement.model'
import type { StockMovementType, StockReferenceType } from './stock-movement.model'
import { resolveDefaultWarehouse } from './warehouses.service'
import type { StockMovementQuery } from './stock-movement.schema'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'

interface ApplyMovementParams {
  variantId:     string
  warehouseId:   string
  orgId:         string
  movementType:  StockMovementType
  referenceType: StockReferenceType
  referenceId:   string | null
  quantityDelta: Decimal
  notes:         string | null
  actorId:       string | null
}

export async function applyMovement(params: ApplyMovementParams, t: Transaction): Promise<void> {
  const { variantId, warehouseId, orgId, movementType, referenceType, referenceId, quantityDelta, notes, actorId } = params

  const [item] = await StockItem.findOrCreate({
    where:    { variant_id: variantId, warehouse_id: warehouseId },
    defaults: { variant_id: variantId, warehouse_id: warehouseId, org_id: orgId, quantity: '0' },
    transaction: t,
    lock: true,
  })

  const before = new Decimal(item.quantity)
  const after  = before.plus(quantityDelta)

  if (after.lt(0)) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  await item.update({ quantity: after.toFixed(4) }, { transaction: t })

  await StockMovement.create(
    {
      variant_id:      variantId,
      warehouse_id:    warehouseId,
      org_id:          orgId,
      movement_type:   movementType,
      reference_type:  referenceType,
      reference_id:    referenceId,
      quantity_delta:  quantityDelta.toFixed(4),
      quantity_before: before.toFixed(4),
      quantity_after:  after.toFixed(4),
      notes,
      created_by:      actorId,
      updated_by:      actorId,
    },
    { transaction: t },
  )

  // Sync denormalized stock_quantity on product_variant
  const ProductVariant = (await import('@/modules/catalog/product-variant.model')).default
  const totalStock = await StockItem.sum('quantity', {
    where: { variant_id: variantId },
    transaction: t,
  }) as number | null
  await ProductVariant.update(
    { stock_quantity: Math.max(0, Math.round((totalStock ?? 0) * 10000) / 10000) },
    { where: { id: variantId }, transaction: t },
  )
}

export async function deductStockForOrder(orderId: string, orgId: string, actorId: string, t: Transaction): Promise<void> {
  const SalesOrderItem  = (await import('@/modules/sales/sales-order-item.model')).default
  const Product         = (await import('@/modules/catalog/product.model')).default
  const ProductVariant  = (await import('@/modules/catalog/product-variant.model')).default
  const SalesOrder      = (await import('@/modules/sales/sales-order.model')).default

  const order = await SalesOrder.findByPk(orderId, { attributes: ['id', 'branch_id'], transaction: t })
  if (!order) return

  const warehouseId = await resolveDefaultWarehouse(order.branch_id, orgId, t)
  if (!warehouseId) {
    logger.warn({ orderId, orgId }, 'no warehouse found for order branch — skipping stock deduction')
    return
  }

  const items = await SalesOrderItem.findAll({
    where: { order_id: orderId },
    attributes: ['id', 'variant_id', 'product_id', 'quantity'],
    transaction: t,
  })

  for (const item of items) {
    const variantId = await resolveVariantId(item.variant_id, item.product_id, orgId, ProductVariant, t)
    if (!variantId) continue

    const variant = await ProductVariant.findByPk(variantId, { attributes: ['manage_stock'], transaction: t })
    if (!variant?.manage_stock) continue

    const product = item.product_id
      ? await Product.findByPk(item.product_id, { attributes: ['product_type'], transaction: t })
      : null
    if (product?.product_type === 'service') continue

    await applyMovement({
      variantId,
      warehouseId,
      orgId,
      movementType:  'out',
      referenceType: 'order',
      referenceId:   orderId,
      quantityDelta: new Decimal(item.quantity).negated(),
      notes:         null,
      actorId,
    }, t)
  }
}

export async function restoreStockForOrder(orderId: string, orgId: string, actorId: string, t: Transaction): Promise<void> {
  const StockMovementModel = StockMovement

  const movements = await StockMovementModel.findAll({
    where: { reference_type: 'order', reference_id: orderId, movement_type: 'out', org_id: orgId },
    transaction: t,
  })

  if (movements.length === 0) return

  for (const mv of movements) {
    await applyMovement({
      variantId:     mv.variant_id,
      warehouseId:   mv.warehouse_id,
      orgId,
      movementType:  'in',
      referenceType: 'order',
      referenceId:   orderId,
      quantityDelta: new Decimal(mv.quantity_delta).abs(),
      notes:         'Restauración por cancelación',
      actorId,
    }, t)
  }
}

export async function manualAdjustment(
  variantId:    string,
  warehouseId:  string,
  newQuantity:  number,
  notes:        string | null,
  ctx:          TenantContext,
): Promise<void> {
  await sequelize.transaction(async (t) => {
    const [item] = await StockItem.findOrCreate({
      where:    { variant_id: variantId, warehouse_id: warehouseId },
      defaults: { variant_id: variantId, warehouse_id: warehouseId, org_id: ctx.orgId, quantity: '0' },
      transaction: t,
      lock: true,
    })

    const before = new Decimal(item.quantity)
    const after  = new Decimal(newQuantity)
    const delta  = after.minus(before)

    if (delta.isZero()) {
      return
    }

    await applyMovement({
      variantId,
      warehouseId,
      orgId:         ctx.orgId,
      movementType:  'adjustment',
      referenceType: 'manual',
      referenceId:   null,
      quantityDelta: delta,
      notes,
      actorId: ctx.userId,
    }, t)
  })
}

export async function listMovements(query: StockMovementQuery, orgId: string) {
  const { page, limit, variant_id, warehouse_id, reference_type, search } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (variant_id)     where.variant_id     = variant_id
  if (warehouse_id)   where.warehouse_id   = warehouse_id
  if (reference_type) where.reference_type = reference_type
  if (search) {
    const like = `%${search}%`
    where[Op.or as unknown as string] = [
      { '$variant.sku$':          { [Op.iLike]: like } },
      { '$variant.name$':         { [Op.iLike]: like } },
      { '$variant.product.name$': { [Op.iLike]: like } },
    ]
  }

  const { rows, count } = await StockMovement.findAndCountAll({
    where,
    limit,
    offset,
    subQuery: false,
    order: [['created_at', 'DESC']],
    include: [
      {
        model:      ProductVariant,
        as:         'variant',
        attributes: ['id', 'sku', 'name', 'is_default'],
        required:   !!search,
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  })

  // Resolve order_number for movements referencing sales orders — batch, no N+1
  const orderIds = [...new Set(
    rows
      .filter(m => m.reference_type === 'order' && m.reference_id)
      .map(m => m.reference_id as string),
  )]
  const orderNumbers: Record<string, string> = {}
  if (orderIds.length > 0) {
    const SalesOrder = (await import('@/modules/sales/sales-order.model')).default
    const orders = await SalesOrder.findAll({
      where:      { id: orderIds },
      attributes: ['id', 'order_number'],
    })
    for (const o of orders) orderNumbers[o.id] = o.order_number
  }

  const data = rows.map(m => ({
    ...m.toJSON(),
    order_number: m.reference_type === 'order' && m.reference_id
      ? (orderNumbers[m.reference_id] ?? null)
      : null,
  }))

  return { ...toPaginated(rows, count, page, limit), data }
}

async function resolveVariantId(
  variantId: string | null,
  productId: string | null,
  orgId: string,
  ProductVariant: { findOne: (opts: object) => Promise<{ id: string } | null> },
  t: Transaction,
): Promise<string | null> {
  if (variantId) return variantId
  if (!productId) return null
  const v = await ProductVariant.findOne({
    where: { product_id: productId, org_id: orgId, is_default: true },
    attributes: ['id'],
    transaction: t,
  })
  return v?.id ?? null
}
