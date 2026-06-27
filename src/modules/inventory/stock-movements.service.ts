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
  /** Inbound only: lot code for the batch the quantity lands on. */
  batchCode?:    string | null
  /** Inbound only: expiry (YYYY-MM-DD) for the batch the quantity lands on. */
  expiryDate?:   string | null
}

/**
 * Applies a stock movement to a (variant, warehouse) pair with batch (lote)
 * traceability and FEFO consumption.
 *
 * `stock_items.quantity` is the authoritative aggregate and is always updated
 * atomically here, under a row lock. Batches under the item are kept in sync:
 *
 * - Inbound (delta > 0): the quantity lands on a single batch — the one named
 *   by `batchCode`/`expiryDate`, or the legacy/default batch otherwise. One
 *   `stock_movements` row is written, linked to that batch.
 * - Outbound (delta < 0): batches are consumed in FEFO order (earliest expiry
 *   first, NULLs last), splitting across batches as needed. ONE
 *   `stock_movements` row is written per batch consumed, each linked to its
 *   batch via `batch_id`, so the ledger reflects exactly which lots left.
 *
 * `expires_on` on the aggregate is kept in sync with the earliest live batch
 * expiry so the existing expiry-alert queries keep working unchanged.
 */
export async function applyMovement(params: ApplyMovementParams, t: Transaction): Promise<void> {
  const { variantId, warehouseId, orgId, movementType, referenceType, referenceId, quantityDelta, notes, actorId } = params
  const { allocateInbound, consumeFefo, earliestExpiry } = await import('./stock-batches.service')

  const [item] = await StockItem.findOrCreate({
    where:    { variant_id: variantId, warehouse_id: warehouseId },
    defaults: { variant_id: variantId, warehouse_id: warehouseId, org_id: orgId, quantity: '0' },
    transaction: t,
  })

  const before = new Decimal(item.quantity)
  const after  = before.plus(quantityDelta)

  if (after.lt(0)) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  // Allocate against batches, producing one movement per affected batch.
  // running tracks the aggregate before/after per ledger row so the ledger
  // remains a faithful, additive trail even when an outbound splits.
  let running = before
  const writeMovement = async (delta: Decimal, batchId: string | null) => {
    const rowBefore = running
    const rowAfter  = running.plus(delta)
    running = rowAfter
    await StockMovement.create(
      {
        variant_id:      variantId,
        warehouse_id:    warehouseId,
        org_id:          orgId,
        movement_type:   movementType,
        reference_type:  referenceType,
        reference_id:    referenceId,
        batch_id:        batchId,
        quantity_delta:  delta.toFixed(4),
        quantity_before: rowBefore.toFixed(4),
        quantity_after:  rowAfter.toFixed(4),
        notes,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )
  }

  if (quantityDelta.gt(0)) {
    const alloc = await allocateInbound(
      { orgId, stockItemId: item.id, quantity: quantityDelta, batchCode: params.batchCode ?? null, expiryDate: params.expiryDate ?? null },
      t,
    )
    await writeMovement(quantityDelta, alloc.batchId)
  } else if (quantityDelta.lt(0)) {
    const allocations = await consumeFefo({ stockItemId: item.id, quantity: quantityDelta.abs() }, t)
    for (const alloc of allocations) {
      await writeMovement(alloc.quantity.negated(), alloc.batchId)
    }
  } else {
    // Zero-delta movement (rare): record it for the audit trail, no batch.
    await writeMovement(quantityDelta, null)
  }

  await item.update(
    { quantity: after.toFixed(4), expires_on: await earliestExpiry(item.id, t) },
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

/** Restores only quantities not already returned via sales_returns. */
export async function restoreRemainingStockForOrder(
  orderId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const SalesOrderItem = (await import('@/modules/sales/sales-order-item.model')).default
  const SalesOrder     = (await import('@/modules/sales/sales-order.model')).default
  const Product        = (await import('@/modules/catalog/product.model')).default
  const ProductVariant = (await import('@/modules/catalog/product-variant.model')).default

  const order = await SalesOrder.findByPk(orderId, { attributes: ['id', 'branch_id'], transaction: t })
  if (!order?.branch_id) return

  const warehouseId = await resolveDefaultWarehouse(order.branch_id, orgId, t)
  if (!warehouseId) return

  const items = await SalesOrderItem.findAll({
    where: { order_id: orderId },
    attributes: ['id', 'variant_id', 'product_id', 'quantity', 'returned_qty'],
    transaction: t,
  })

  for (const item of items) {
    const remaining = new Decimal(item.quantity).minus(new Decimal(item.returned_qty ?? '0'))
    if (remaining.lte(0)) continue

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
      movementType:  'in',
      referenceType: 'invoice_cancel',
      referenceId:   orderId,
      quantityDelta: remaining,
      notes:         'Restauración por cancelación de factura',
      actorId,
    }, t)
  }
}

export async function restoreStockForReturn(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const SalesReturnItem = (await import('@/modules/sales/sales-return-item.model')).default
  const SalesReturn     = (await import('@/modules/sales/sales-return.model')).default
  const Product         = (await import('@/modules/catalog/product.model')).default
  const ProductVariant  = (await import('@/modules/catalog/product-variant.model')).default

  const salesReturn = await SalesReturn.findByPk(returnId, {
    attributes: ['id', 'warehouse_id', 'order_id'],
    transaction: t,
  })
  if (!salesReturn?.warehouse_id) return

  const items = await SalesReturnItem.findAll({
    where: { return_id: returnId },
    attributes: ['id', 'variant_id', 'product_id', 'quantity', 'batch_code', 'expiry_date'],
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
      warehouseId:   salesReturn.warehouse_id,
      orgId,
      movementType:  'in',
      referenceType: 'sales_return',
      referenceId:   returnId,
      quantityDelta: new Decimal(item.quantity),
      batchCode:     item.batch_code ?? null,
      expiryDate:    item.expiry_date ?? null,
      notes:         'Devolución de venta',
      actorId,
    }, t)
  }
}

export async function deductStockForExchange(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const SalesReturnExchangeItem = (await import('@/modules/sales/sales-return-exchange-item.model')).default
  const SalesReturn               = (await import('@/modules/sales/sales-return.model')).default
  const Product                   = (await import('@/modules/catalog/product.model')).default
  const ProductVariant              = (await import('@/modules/catalog/product-variant.model')).default

  const salesReturn = await SalesReturn.findByPk(returnId, {
    attributes: ['id', 'warehouse_id'],
    transaction: t,
  })
  if (!salesReturn?.warehouse_id) return

  const items = await SalesReturnExchangeItem.findAll({
    where: { return_id: returnId },
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
      warehouseId:   salesReturn.warehouse_id,
      orgId,
      movementType:  'out',
      referenceType: 'sales_exchange',
      referenceId:   returnId,
      quantityDelta: new Decimal(item.quantity).negated(),
      notes:         'Cambio de mercadería',
      actorId,
    }, t)
  }
}

export async function reverseStockForReturn(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const movements = await StockMovement.findAll({
    where: {
      reference_id: returnId,
      reference_type: { [Op.in]: ['sales_return', 'sales_exchange'] },
      org_id: orgId,
    },
    transaction: t,
  })

  for (const mv of movements) {
    const reverseType = mv.reference_type === 'sales_return' ? 'sales_return' : 'sales_exchange'
    await applyMovement({
      variantId:     mv.variant_id,
      warehouseId:   mv.warehouse_id,
      orgId,
      movementType:  mv.movement_type === 'in' ? 'out' : 'in',
      referenceType: reverseType as StockReferenceType,
      referenceId:   returnId,
      quantityDelta: new Decimal(mv.quantity_delta).negated(),
      notes:         'Reversión de devolución',
      actorId,
    }, t)
  }
}

/**
 * Deducts stock for a purchase return (devolución a proveedor): goods leave our
 * warehouse and go back to the supplier, so each returnable line produces an
 * outbound movement.
 */
export async function deductStockForPurchaseReturn(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const PurchaseReturnItem = (await import('@/modules/purchases/purchase-return-item.model')).default
  const PurchaseReturn     = (await import('@/modules/purchases/purchase-return.model')).default
  const Product            = (await import('@/modules/catalog/product.model')).default
  const ProductVariant     = (await import('@/modules/catalog/product-variant.model')).default

  const purchaseReturn = await PurchaseReturn.findByPk(returnId, {
    attributes: ['id', 'warehouse_id'],
    transaction: t,
  })
  if (!purchaseReturn?.warehouse_id) return

  const items = await PurchaseReturnItem.findAll({
    where: { return_id: returnId },
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
      warehouseId:   purchaseReturn.warehouse_id,
      orgId,
      movementType:  'out',
      referenceType: 'purchase_return',
      referenceId:   returnId,
      quantityDelta: new Decimal(item.quantity).negated(),
      notes:         'Devolución a proveedor',
      actorId,
    }, t)
  }
}

/**
 * Adds stock for the replacement goods of a purchase exchange (cambio): the
 * supplier ships us new units in place of what we returned, so each line lands
 * an inbound movement.
 */
export async function addStockForPurchaseExchange(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const PurchaseReturnExchangeItem = (await import('@/modules/purchases/purchase-return-exchange-item.model')).default
  const PurchaseReturn             = (await import('@/modules/purchases/purchase-return.model')).default
  const Product                    = (await import('@/modules/catalog/product.model')).default
  const ProductVariant             = (await import('@/modules/catalog/product-variant.model')).default

  const purchaseReturn = await PurchaseReturn.findByPk(returnId, {
    attributes: ['id', 'warehouse_id'],
    transaction: t,
  })
  if (!purchaseReturn?.warehouse_id) return

  const items = await PurchaseReturnExchangeItem.findAll({
    where: { return_id: returnId },
    attributes: ['id', 'variant_id', 'product_id', 'quantity', 'batch_code', 'expiry_date'],
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
      warehouseId:   purchaseReturn.warehouse_id,
      orgId,
      movementType:  'in',
      referenceType: 'purchase_exchange',
      referenceId:   returnId,
      quantityDelta: new Decimal(item.quantity),
      batchCode:     item.batch_code ?? null,
      expiryDate:    item.expiry_date ?? null,
      notes:         'Cambio de mercadería (compra)',
      actorId,
    }, t)
  }
}

/** Reverses the stock movements written by a purchase return/exchange (on cancel). */
export async function reverseStockForPurchaseReturn(
  returnId: string,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const movements = await StockMovement.findAll({
    where: {
      reference_id: returnId,
      reference_type: { [Op.in]: ['purchase_return', 'purchase_exchange'] },
      org_id: orgId,
    },
    transaction: t,
  })

  for (const mv of movements) {
    await applyMovement({
      variantId:     mv.variant_id,
      warehouseId:   mv.warehouse_id,
      orgId,
      movementType:  mv.movement_type === 'in' ? 'out' : 'in',
      referenceType: mv.reference_type as StockReferenceType,
      referenceId:   returnId,
      quantityDelta: new Decimal(mv.quantity_delta).negated(),
      notes:         'Reversión de devolución a proveedor',
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
  batch?:       { batchCode: string | null; expiryDate: string | null },
): Promise<void> {
  await sequelize.transaction(async (t) => {
    const [item] = await StockItem.findOrCreate({
      where:    { variant_id: variantId, warehouse_id: warehouseId },
      defaults: { variant_id: variantId, warehouse_id: warehouseId, org_id: ctx.orgId, quantity: '0' },
      transaction: t,
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
      // Batch hint only applies to inbound adjustments; ignored when adjusting down.
      batchCode:     delta.gt(0) ? (batch?.batchCode ?? null) : null,
      expiryDate:    delta.gt(0) ? (batch?.expiryDate ?? null) : null,
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

  const StockItemBatch = (await import('./stock-item-batch.model')).default

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
      {
        model:      StockItemBatch,
        as:         'batch',
        attributes: ['id', 'batch_code', 'expiry_date'],
        required:   false,
        paranoid:   false,
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
