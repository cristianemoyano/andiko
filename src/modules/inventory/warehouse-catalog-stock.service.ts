import 'server-only'
import Decimal from 'decimal.js'
import { Op, literal } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { ImportProgressCallback } from '@/lib/import-progress'
import { createImportProgressReporter } from '@/lib/import-progress'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from './stock-item.model'
import { applyMovement } from './stock-movements.service'
import { getWarehouse } from './warehouses.service'
import { resolveDefaultMinimumForWarehouse } from './stock-items.service'
import type {
  BulkLoadCatalogStockFromFilterInput,
  CatalogStockCandidatesQuery,
  LoadCatalogStockBatchInput,
} from './warehouse-catalog-stock.schema'

export type CatalogStockCandidateRow = {
  variant_id: string
  sku: string
  variant_name: string | null
  product_name: string
  /** Cantidad en este depósito; `0` si no hay fila de stock. */
  warehouse_quantity: string
  /** Si ya existe registro stock_items (variante × depósito), aunque la cantidad sea 0. */
  in_warehouse: boolean
}

function assertWarehouseBranchAllowed(ctx: TenantContext, warehouseBranchId: string | null) {
  if (ctx.allowedBranchIds.length === 0) return
  if (!warehouseBranchId || !ctx.allowedBranchIds.includes(warehouseBranchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
}

const BULK_PROCESS_CHUNK = 500
const BULK_TX_BATCH = 200

async function syncVariantStockTotals(variantIds: string[], t: Transaction): Promise<void> {
  if (variantIds.length === 0) return
  await sequelize.query(
    `UPDATE product_variants AS pv
     SET stock_quantity = GREATEST(0, ROUND(COALESCE(agg.total, 0)::numeric, 4))
     FROM (
       SELECT variant_id, SUM(quantity::numeric) AS total
       FROM stock_items
       WHERE variant_id IN (:variantIds)
       GROUP BY variant_id
     ) AS agg
     WHERE pv.id = agg.variant_id`,
    { replacements: { variantIds }, transaction: t },
  )
}

/** Procesa un lote dentro de una transacción: precarga stock_items y sincroniza variantes al final. */
async function processBulkCatalogStockBatch(
  ctx: TenantContext,
  warehouseId: string,
  variantIds: string[],
  quantity: number,
  actorId: string,
  notes: string,
  defaultMinimum: string,
  t: Transaction,
): Promise<{ updated: number; unchanged: number; skipped: number }> {
  if (variantIds.length === 0) {
    return { updated: 0, unchanged: 0, skipped: 0 }
  }

  let items = await StockItem.findAll({
    where: {
      org_id:       ctx.orgId,
      warehouse_id: warehouseId,
      variant_id:   { [Op.in]: variantIds },
    },
    transaction: t,
    lock:        true,
  })
  const byVariant = new Map(items.map((item) => [item.variant_id, item]))

  const missingIds = variantIds.filter((id) => !byVariant.has(id))
  if (missingIds.length > 0) {
    await StockItem.bulkCreate(
      missingIds.map((variantId) => ({
        variant_id:       variantId,
        warehouse_id:     warehouseId,
        org_id:           ctx.orgId,
        quantity:         '0',
        minimum_quantity: defaultMinimum,
      })),
      { transaction: t },
    )
    items = await StockItem.findAll({
      where: {
        org_id:       ctx.orgId,
        warehouse_id: warehouseId,
        variant_id:   { [Op.in]: variantIds },
      },
      transaction: t,
      lock:        true,
    })
    for (const item of items) {
      byVariant.set(item.variant_id, item)
    }
  }

  let updated = 0
  let unchanged = 0
  let skipped = 0
  const syncVariantIds: string[] = []
  const target = new Decimal(quantity)

  for (const variantId of variantIds) {
    const item = byVariant.get(variantId)
    if (!item) continue

    const current = new Decimal(item.quantity)
    if (current.gt(0)) {
      skipped++
      continue
    }

    const delta = target.minus(current)
    if (delta.isZero()) {
      unchanged++
      continue
    }

    await applyMovement({
      variantId,
      warehouseId,
      orgId:                ctx.orgId,
      movementType:         'adjustment',
      referenceType:        'initial',
      referenceId:          null,
      quantityDelta:        delta,
      notes,
      actorId,
      stockItem:            item,
      defaultMinimum,
      skipVariantStockSync: true,
      skipWooEnqueue:       true,
    }, t)
    updated++
    syncVariantIds.push(variantId)
  }

  await syncVariantStockTotals(syncVariantIds, t)
  return { updated, unchanged, skipped }
}

type CatalogCandidateFilter = {
  search?: string
  only_not_in_warehouse?: boolean
}

async function buildCatalogCandidateVariantWhere(
  warehouseId: string,
  filter: CatalogCandidateFilter,
  ctx: TenantContext,
): Promise<{ variantWhere: Record<string, unknown>; productWhere: Record<string, unknown> }> {
  const variantWhere: Record<string, unknown> = {
    org_id:       ctx.orgId,
    manage_stock: true,
  }

  if (filter.only_not_in_warehouse) {
    variantWhere[Op.and as unknown as string] = [
      literal(`NOT EXISTS (
        SELECT 1 FROM stock_items si
        WHERE si.variant_id = "ProductVariant"."id"
        AND si.org_id = ${sequelize.escape(ctx.orgId)}
        AND si.warehouse_id = ${sequelize.escape(warehouseId)}
      )`),
    ]
  }

  const productWhere: Record<string, unknown> = { org_id: ctx.orgId, status: 'active' }
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`
    variantWhere[Op.or as unknown as string] = [
      { sku: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { barcode: { [Op.iLike]: term } },
      { '$product.name$': { [Op.iLike]: term } },
    ]
  }

  return { variantWhere, productWhere }
}

async function countCatalogCandidates(
  warehouseId: string,
  filter: CatalogCandidateFilter,
  ctx: TenantContext,
): Promise<number> {
  const { variantWhere, productWhere } = await buildCatalogCandidateVariantWhere(warehouseId, filter, ctx)
  // Sin DISTINCT: variante → producto es N:1; DISTINCT + col rompe el alias en Sequelize.
  return ProductVariant.count({
    where: variantWhere,
    include: [{
      model:      Product,
      as:         'product',
      required:   true,
      where:      productWhere,
      attributes: [],
    }],
  })
}

export async function listCatalogStockCandidates(
  warehouseId: string,
  query: CatalogStockCandidatesQuery,
  ctx: TenantContext,
): Promise<{ data: CatalogStockCandidateRow[]; total: number; page: number; limit: number }> {
  const warehouse = await getWarehouse(warehouseId, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const { page, limit, search, only_not_in_warehouse } = query
  const { offset } = paginate(page, limit)

  const { variantWhere, productWhere } = await buildCatalogCandidateVariantWhere(
    warehouseId,
    { search, only_not_in_warehouse },
    ctx,
  )

  const { rows, count } = await ProductVariant.findAndCountAll({
    where: variantWhere,
    limit,
    offset,
    subQuery: false,
    order: [['sku', 'ASC']],
    attributes: ['id', 'sku', 'name'],
    include: [{
      model:      Product,
      as:         'product',
      required:   true,
      where:      productWhere,
      attributes: ['name'],
    }],
  })

  const variantIds = rows.map((v) => v.id)
  const stockByVariant = new Map<string, string>()
  if (variantIds.length > 0) {
    const stockRows = await StockItem.findAll({
      where: {
        org_id:       ctx.orgId,
        warehouse_id: warehouseId,
        variant_id:   { [Op.in]: variantIds },
      },
      attributes: ['variant_id', 'quantity'],
    })
    for (const row of stockRows) {
      stockByVariant.set(row.variant_id, row.quantity)
    }
  }

  const data: CatalogStockCandidateRow[] = rows.map((variant) => ({
    variant_id:         variant.id,
    sku:                variant.sku,
    variant_name:       variant.name,
    product_name:       (variant as unknown as { product: { name: string } }).product.name,
    warehouse_quantity: stockByVariant.get(variant.id) ?? '0',
    in_warehouse:       stockByVariant.has(variant.id),
  }))

  return toPaginated(data, count, page, limit)
}

type StockSetOutcome = 'updated' | 'unchanged' | 'skipped'

async function setStockQuantityInWarehouse(
  ctx: TenantContext,
  warehouseId: string,
  variantId: string,
  targetQuantity: number,
  actorId: string,
  notes: string,
  transaction: Transaction,
  options?: { skipIfHasStock?: boolean; defaultMinimum?: string },
): Promise<StockSetOutcome> {
  const defaultMinimum = options?.defaultMinimum
    ?? await resolveDefaultMinimumForWarehouse(warehouseId, ctx.orgId, transaction)

  const [item] = await StockItem.findOrCreate({
    where:    { variant_id: variantId, warehouse_id: warehouseId },
    defaults: {
      variant_id:       variantId,
      warehouse_id:     warehouseId,
      org_id:           ctx.orgId,
      quantity:         '0',
      minimum_quantity: defaultMinimum,
    },
    transaction,
    lock: true,
  })

  const current = new Decimal(item.quantity)
  if (options?.skipIfHasStock && current.gt(0)) {
    return 'skipped'
  }

  const target = new Decimal(targetQuantity)
  const delta = target.minus(current)
  if (delta.isZero()) return 'unchanged'

  await applyMovement({
    variantId,
    warehouseId,
    orgId:         ctx.orgId,
    movementType:  'adjustment',
    referenceType: 'initial',
    referenceId:   null,
    quantityDelta: delta,
    notes,
    actorId,
    stockItem:     item,
    defaultMinimum,
  }, transaction)

  return 'updated'
}

export async function loadCatalogStockBatch(
  warehouseId: string,
  input: LoadCatalogStockBatchInput,
  ctx: TenantContext,
  actorId: string,
): Promise<{ updated: number; unchanged: number; skipped: number }> {
  const warehouse = await getWarehouse(warehouseId, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const notes = input.notes?.trim() || 'Carga masiva desde catálogo'
  const variantIds = [...new Set(input.items.map((item) => item.variant_id))]

  const variants = await ProductVariant.findAll({
    where: {
      id:           { [Op.in]: variantIds },
      org_id:       ctx.orgId,
      manage_stock: true,
    },
    attributes: ['id'],
    include: [{
      model:      Product,
      as:         'product',
      required:   true,
      where:      { org_id: ctx.orgId, status: 'active' },
      attributes: ['id'],
    }],
  })
  const allowedIds = new Set(variants.map((v) => v.id))

  let updated = 0
  let unchanged = 0
  let skipped = 0

  const defaultMinimum = await resolveDefaultMinimumForWarehouse(warehouseId, ctx.orgId)

  await sequelize.transaction(async (t) => {
    for (const item of input.items) {
      if (!allowedIds.has(item.variant_id)) {
        throw new Error('VARIANT_NOT_FOUND')
      }
      const outcome = await setStockQuantityInWarehouse(
        ctx,
        warehouseId,
        item.variant_id,
        item.quantity,
        actorId,
        notes,
        t,
        { skipIfHasStock: true, defaultMinimum },
      )
      if (outcome === 'updated') updated++
      else if (outcome === 'skipped') skipped++
      else unchanged++
    }
  })

  logger.info({ warehouseId, updated, unchanged, skipped, orgId: ctx.orgId, actorId }, 'catalog stock loaded into warehouse')
  return { updated, unchanged, skipped }
}

export type BulkLoadCatalogStockResult = {
  updated: number
  unchanged: number
  skipped: number
  total: number
  processed: number
  cancelled?: boolean
}

export const BULK_LOAD_CANCELLED = 'BULK_LOAD_CANCELLED'

export class BulkLoadCancelledError extends Error {
  readonly result: BulkLoadCatalogStockResult

  constructor(result: BulkLoadCatalogStockResult) {
    super(BULK_LOAD_CANCELLED)
    this.name = 'BulkLoadCancelledError'
    this.result = result
  }
}

function throwIfBulkAborted(
  signal: AbortSignal | undefined,
  snapshot: Omit<BulkLoadCatalogStockResult, 'cancelled'>,
): void {
  if (!signal?.aborted) return
  throw new BulkLoadCancelledError({ ...snapshot, cancelled: true })
}

/** Carga la misma cantidad en todos los productos del catálogo que coinciden con el filtro (sin límite en cliente). */
export async function bulkLoadCatalogStockForFilter(
  warehouseId: string,
  input: BulkLoadCatalogStockFromFilterInput,
  ctx: TenantContext,
  actorId: string,
  onProgress?: ImportProgressCallback,
  signal?: AbortSignal,
): Promise<BulkLoadCatalogStockResult> {
  const warehouse = await getWarehouse(warehouseId, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const filter: CatalogCandidateFilter = {
    search: input.search,
    only_not_in_warehouse: input.only_not_in_warehouse,
  }
  const { variantWhere, productWhere } = await buildCatalogCandidateVariantWhere(warehouseId, filter, ctx)
  const total = await countCatalogCandidates(warehouseId, filter, ctx)

  if (total === 0) {
    return { updated: 0, unchanged: 0, skipped: 0, total: 0, processed: 0 }
  }

  const notes = input.notes?.trim() || 'Carga masiva desde catálogo'
  const defaultMinimum = await resolveDefaultMinimumForWarehouse(warehouseId, ctx.orgId)
  const progress = createImportProgressReporter(total, onProgress)
  let updated = 0
  let unchanged = 0
  let skipped = 0
  let processed = 0
  let lastSku: string | null = null

  while (processed < total) {
    throwIfBulkAborted(signal, { updated, unchanged, skipped, total, processed })

    const pageWhere: Record<string, unknown> = { ...variantWhere }
    if (lastSku != null) {
      pageWhere.sku = { [Op.gt]: lastSku }
    }

    const rows = await ProductVariant.findAll({
      where: pageWhere,
      limit: BULK_PROCESS_CHUNK,
      subQuery: false,
      order: [['sku', 'ASC']],
      attributes: ['id', 'sku'],
      include: [{
        model:      Product,
        as:         'product',
        required:   true,
        where:      productWhere,
        attributes: [],
      }],
    })

    if (rows.length === 0) break

    for (let i = 0; i < rows.length; i += BULK_TX_BATCH) {
      throwIfBulkAborted(signal, { updated, unchanged, skipped, total, processed })

      const batch = rows.slice(i, i + BULK_TX_BATCH)
      const batchIds = batch.map((row) => row.id)
      await sequelize.transaction(async (t) => {
        const batchResult = await processBulkCatalogStockBatch(
          ctx,
          warehouseId,
          batchIds,
          input.quantity,
          actorId,
          notes,
          defaultMinimum,
          t,
        )
        updated += batchResult.updated
        unchanged += batchResult.unchanged
        skipped += batchResult.skipped
      })
      processed += batch.length
      progress.tick(processed)
    }

    lastSku = rows[rows.length - 1]!.sku
    if (rows.length < BULK_PROCESS_CHUNK) break
  }

  progress.finish()
  logger.info({
    warehouseId,
    updated,
    unchanged,
    skipped,
    total,
    orgId: ctx.orgId,
    actorId,
    filter,
  }, 'bulk catalog stock loaded into warehouse')

  return { updated, unchanged, skipped, total, processed }
}
