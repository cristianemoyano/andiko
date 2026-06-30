import 'server-only'
import Decimal from 'decimal.js'
import { Op, literal } from 'sequelize'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import StockItem from './stock-item.model'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import type { StockItemAlertsPatchInput, StockLevelQuery, BulkStockMinimumInput, BulkStockExpiryInput, ApplyWarehouseDefaultMinimumInput } from './stock-level.schema'
import { getWarehouse } from './warehouses.service'

/** Stock mínimo default del depósito, para nuevos stock_items. */
export async function resolveDefaultMinimumForWarehouse(
  warehouseId: string,
  orgId: string,
  t?: import('sequelize').Transaction,
): Promise<string> {
  const wh = await Warehouse.findOne({
    where: { id: warehouseId, org_id: orgId },
    attributes: ['default_minimum_quantity'],
    transaction: t,
  })
  if (!wh) return '0'
  const min = new Decimal(wh.default_minimum_quantity ?? 0)
  return min.gte(0) ? min.toFixed(4) : '0'
}

export async function getStockLevels(query: StockLevelQuery, orgId: string) {
  const { page, limit, warehouse_id, variant_id, search, below_minimum, expired, expiring_within_days } = query
  const { offset } = paginate(page, limit)

  const andParts: object[] = [{ org_id: orgId }]
  if (warehouse_id) andParts.push({ warehouse_id })
  if (variant_id) andParts.push({ variant_id })
  if (search) {
    const like = `%${search}%`
    andParts.push({
      [Op.or as unknown as string]: [
        { '$variant.sku$':          { [Op.iLike]: like } },
        { '$variant.name$':         { [Op.iLike]: like } },
        { '$variant.product.name$': { [Op.iLike]: like } },
      ],
    })
  }
  if (below_minimum) {
    andParts.push(
      literal(
        '("StockItem"."minimum_quantity" > 0 AND "StockItem"."quantity" <= "StockItem"."minimum_quantity")',
      ),
    )
  }
  if (expired) {
    andParts.push(
      literal(
        '("StockItem"."expires_on" IS NOT NULL AND "StockItem"."expires_on" < CURRENT_DATE)',
      ),
    )
  }
  if (expiring_within_days != null) {
    const days = Number(expiring_within_days)
    andParts.push(
      literal(
        `("StockItem"."expires_on" IS NOT NULL AND "StockItem"."expires_on" >= CURRENT_DATE AND "StockItem"."expires_on" <= CURRENT_DATE + (${days} * INTERVAL '1 day'))`,
      ),
    )
  }

  const where = { [Op.and]: andParts }

  const { rows, count } = await StockItem.findAndCountAll({
    where,
    limit,
    offset,
    subQuery: false,
    order: [['warehouse_id', 'ASC'], ['variant_id', 'ASC']],
    include: [
      { model: Warehouse,      as: 'warehouse', attributes: ['id', 'name', 'branch_id'] },
      {
        model:      ProductVariant,
        as:         'variant',
        attributes: ['id', 'sku', 'name', 'is_default'],
        required:   !!search,
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

function assertWarehouseBranchAllowed(ctx: TenantContext, warehouseBranchId: string | null) {
  if (ctx.allowedBranchIds.length === 0) return
  if (!warehouseBranchId || !ctx.allowedBranchIds.includes(warehouseBranchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
}

/** Aplica vencimiento de alerta en el lote default y sincroniza `stock_items.expires_on`. */
export async function applyStockItemExpiryAlert(
  ctx: TenantContext,
  item: StockItem,
  expiresOn: string | null,
  t: import('sequelize').Transaction,
): Promise<void> {
  const StockItemBatch = (await import('./stock-item-batch.model')).default
  const { ensureBatchesMatchAggregate, earliestExpiry } = await import('./stock-batches.service')

  await ensureBatchesMatchAggregate(
    { orgId: ctx.orgId, stockItemId: item.id, aggregateQty: new Decimal(item.quantity) },
    t,
  )

  const [defaultBatch] = await StockItemBatch.findOrCreate({
    where:    { stock_item_id: item.id, batch_code: { [Op.is]: null } },
    defaults: { org_id: ctx.orgId, stock_item_id: item.id, batch_code: null, expiry_date: null, quantity: '0' },
    transaction: t,
    lock: true,
  })
  await defaultBatch.update({ expiry_date: expiresOn }, { transaction: t })

  // Fecha explícita del usuario → alerta directa. `null` → derivar del FEFO restante.
  const resolved = expiresOn ?? await earliestExpiry(item.id, t)
  await item.update({ expires_on: resolved }, { transaction: t })
}

export async function updateStockItemAlerts(ctx: TenantContext, input: StockItemAlertsPatchInput): Promise<void> {
  const warehouse = await getWarehouse(input.warehouse_id, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const variant = await ProductVariant.findOne({
    where: { id: input.variant_id, org_id: ctx.orgId },
    attributes: ['id'],
  })
  if (!variant) throw new Error('VARIANT_NOT_FOUND')

  const minQty = new Decimal(input.minimum_quantity).toFixed(4)

  await sequelize.transaction(async (t) => {
    const [item] = await StockItem.findOrCreate({
      where:    { variant_id: input.variant_id, warehouse_id: input.warehouse_id },
      defaults: {
        variant_id:       input.variant_id,
        warehouse_id:     input.warehouse_id,
        org_id:           ctx.orgId,
        quantity:         '0',
        minimum_quantity: '0',
        expires_on:       null,
      },
      transaction: t,
      lock: true,
    })

    await applyStockItemExpiryAlert(ctx, item, input.expires_on, t)
    await item.update({ minimum_quantity: minQty }, { transaction: t })
  })
}

export async function bulkSetStockMinimum(
  ctx: TenantContext,
  input: BulkStockMinimumInput,
): Promise<{ updated: number }> {
  const minQty = new Decimal(input.minimum_quantity).toFixed(4)
  let updated = 0

  await sequelize.transaction(async (t) => {
    for (const { variant_id, warehouse_id } of input.items) {
      const warehouse = await getWarehouse(warehouse_id, ctx.orgId)
      assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

      const item = await StockItem.findOne({
        where: { variant_id, warehouse_id, org_id: ctx.orgId },
        transaction: t,
        lock: true,
      })
      if (!item) continue

      await item.update({ minimum_quantity: minQty }, { transaction: t })
      updated++
    }
  })

  return { updated }
}

export async function bulkSetStockExpiry(
  ctx: TenantContext,
  input: BulkStockExpiryInput,
): Promise<{ updated: number }> {
  let updated = 0

  await sequelize.transaction(async (t) => {
    for (const { variant_id, warehouse_id } of input.items) {
      const warehouse = await getWarehouse(warehouse_id, ctx.orgId)
      assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

      const item = await StockItem.findOne({
        where: { variant_id, warehouse_id, org_id: ctx.orgId },
        transaction: t,
        lock: true,
      })
      if (!item) continue

      await applyStockItemExpiryAlert(ctx, item, input.expires_on, t)
      updated++
    }
  })

  return { updated }
}

export async function applyWarehouseDefaultMinimum(
  ctx: TenantContext,
  warehouseId: string,
  input: ApplyWarehouseDefaultMinimumInput,
): Promise<{ updated: number }> {
  const warehouse = await getWarehouse(warehouseId, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const defaultMin = new Decimal(warehouse.default_minimum_quantity ?? 0)
  if (defaultMin.lte(0)) return { updated: 0 }

  const minQty = defaultMin.toFixed(4)
  const where = input.only_without_minimum
    ? {
        [Op.and]: [
          { org_id: ctx.orgId, warehouse_id: warehouseId },
          literal('"StockItem"."minimum_quantity" = 0'),
        ],
      }
    : { org_id: ctx.orgId, warehouse_id: warehouseId }

  const [count] = await StockItem.update(
    { minimum_quantity: minQty },
    { where },
  )

  return { updated: count }
}

export interface ReplenishmentRow {
  stock_item_id: string
  variant_id: string
  product_id: string | null
  sku: string | null
  product_name: string
  variant_name: string | null
  warehouse_id: string
  warehouse_name: string
  quantity: string
  minimum_quantity: string
  suggested_qty: string
}

export interface ReplenishmentSummary {
  data: ReplenishmentRow[]
  meta: {
    below_minimum_count: number
    items_with_minimum: number
    total_stock_items: number
  }
}

export async function getReplenishmentSummary(orgId: string): Promise<ReplenishmentSummary> {
  const [data, itemsWithMinimum, totalStockItems] = await Promise.all([
    getReplenishmentList(orgId),
    StockItem.count({
      where: {
        org_id: orgId,
        minimum_quantity: { [Op.gt]: 0 },
      },
    }),
    StockItem.count({ where: { org_id: orgId } }),
  ])

  return {
    data,
    meta: {
      below_minimum_count: data.length,
      items_with_minimum: itemsWithMinimum,
      total_stock_items: totalStockItems,
    },
  }
}

export async function getReplenishmentList(orgId: string): Promise<ReplenishmentRow[]> {
  const items = await StockItem.findAll({
    where: {
      org_id: orgId,
      [Op.and]: [
        literal('"StockItem"."minimum_quantity" > 0'),
        literal('"StockItem"."quantity" <= "StockItem"."minimum_quantity"'),
      ],
    },
    attributes: ['id', 'variant_id', 'warehouse_id', 'quantity', 'minimum_quantity'],
    include: [
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
      {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'name'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
    order: [['quantity', 'ASC']],
    limit: 500,
  })

  return items.map((item) => {
    const variant = (item as unknown as { variant: ProductVariant & { product: Product } }).variant
    const warehouse = (item as unknown as { warehouse: Warehouse }).warehouse
    const qty = new Decimal(item.quantity)
    const minQty = new Decimal(item.minimum_quantity)
    return {
      stock_item_id:   item.id,
      variant_id:      item.variant_id,
      product_id:      variant?.product?.id ?? null,
      sku:             variant?.sku ?? null,
      product_name:    variant?.product?.name ?? '',
      variant_name:    variant?.name ?? null,
      warehouse_id:    item.warehouse_id,
      warehouse_name:  warehouse?.name ?? '',
      quantity:        qty.toFixed(2),
      minimum_quantity: minQty.toFixed(2),
      suggested_qty:   Decimal.max(minQty.minus(qty), 0).toFixed(2),
    }
  })
}

export async function getVariantStock(variantId: string, warehouseId: string): Promise<string> {
  const item = await StockItem.findOne({ where: { variant_id: variantId, warehouse_id: warehouseId } })
  return item?.quantity ?? '0'
}

export interface StockBatchRow {
  id: string
  batch_code: string | null
  expiry_date: string | null
  quantity: string
}

/**
 * Returns the live batch breakdown for a stock_item in FEFO order
 * (earliest expiry first, NULL expiry last). Used by the batch breakdown
 * endpoint and stock detail UI.
 */
export async function getStockItemBatches(stockItemId: string, orgId: string): Promise<StockBatchRow[]> {
  const StockItemBatch = (await import('./stock-item-batch.model')).default

  const item = await StockItem.findOne({ where: { id: stockItemId, org_id: orgId }, attributes: ['id'] })
  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')

  const batches = await StockItemBatch.findAll({
    where: { stock_item_id: stockItemId },
    order: [literal('expiry_date ASC NULLS LAST'), ['created_at', 'ASC']],
    attributes: ['id', 'batch_code', 'expiry_date', 'quantity'],
  })

  return batches.map(b => ({
    id:          b.id,
    batch_code:  b.batch_code,
    expiry_date: b.expiry_date,
    quantity:    new Decimal(b.quantity).toFixed(4),
  }))
}
