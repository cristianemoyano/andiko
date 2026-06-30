import 'server-only'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import sequelize from '@/lib/db'
import { paginate } from '@/lib/pagination'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from '@/modules/inventory/stock-item.model'
import { slugForImportedProduct } from '@/modules/catalog/product.utils'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import WoocommerceOrderLink from './woocommerce-order-link.model'
import { buildClientForSite } from './woo-sites.service'
import { ingestWooOrder } from './woo-orders.service'
import { pushAllStockForSite } from './woo-resync.service'
import { activeImportedWooOrderIds, findOrRestoreVariantBySku } from './woo-sync-links.service'
import {
  getImportPreviewSnapshot,
  getOrderImportPreviewSnapshot,
  importPreviewCacheKey,
  invalidateImportPreviewSnapshot,
  invalidateOrderImportPreviewSnapshots,
  orderImportPreviewCacheKey,
  setImportPreviewSnapshot,
  setOrderImportPreviewSnapshot,
  type ImportPreviewSnapshot,
  type OrderImportPreviewItem,
  type OrderImportPreviewSnapshot,
} from './woo-import-preview.cache'
import type {
  WoocommerceImportApplyInput,
  WoocommerceImportPreviewInput,
  WoocommerceOrderImportPreviewInput,
} from './woocommerce.schema'
import type { WooClient, WooOrder, WooProduct } from './woo-client'

/** A single sellable unit on the Woo side (a simple product or one variation). */
interface WooUnit {
  sku: string | null
  name: string
  wooProductId: number
  wooVariationId: number | null
  price: string | null
  stock: number | null
}

const OPEN_STATUSES = ['pending', 'processing', 'on-hold']

function actorFor(site: WoocommerceSite): string {
  return site.created_by ?? site.org_id!
}

/** Flattens a store's catalog into sellable units (expanding variable products). */
async function collectUnits(client: WooClient, products: WooProduct[]): Promise<WooUnit[]> {
  const units: WooUnit[] = []
  for (const p of products) {
    if (p.type === 'variable' && p.variations && p.variations.length > 0) {
      const variations = await client.listVariations(p.id)
      for (const v of variations) {
        units.push({
          sku: v.sku ?? null,
          name: `${p.name}${v.name ? ` - ${v.name}` : ''}`,
          wooProductId: p.id,
          wooVariationId: v.id,
          price: v.regular_price ?? null,
          stock: v.stock_quantity ?? null,
        })
      }
    } else {
      units.push({
        sku: p.sku ?? null,
        name: p.name,
        wooProductId: p.id,
        wooVariationId: null,
        price: p.regular_price ?? null,
        stock: p.stock_quantity ?? null,
      })
    }
  }
  return units
}

export interface ImportPreview {
  woo_total: number
  matched_count: number
  to_import_count: number
  needs_mapping_count: number
  section: WoocommerceImportPreviewInput['section']
  items: ImportPreviewSnapshot['matched'] | ImportPreviewSnapshot['to_import'] | ImportPreviewSnapshot['needs_mapping']
  page: number
  limit: number
  total: number
  pages: number
}

async function buildImportPreviewSnapshot(site: WoocommerceSite): Promise<ImportPreviewSnapshot> {
  const client = buildClientForSite(site)
  const units = await collectUnits(client, await client.listProducts())

  const seen = new Map<string, number>()
  for (const u of units) if (u.sku) seen.set(u.sku, (seen.get(u.sku) ?? 0) + 1)

  const skuList = [...new Set(units.map((u) => u.sku).filter((sku): sku is string => Boolean(sku)))]
  const erpSkus = new Set<string>()
  if (skuList.length > 0) {
    const variants = await ProductVariant.findAll({
      where: { sku: { [Op.in]: skuList }, org_id: site.org_id },
      attributes: ['sku'],
    })
    for (const v of variants) erpSkus.add(v.sku)
  }

  const matched: ImportPreviewSnapshot['matched'] = []
  const toImport: ImportPreviewSnapshot['to_import'] = []
  const needsMapping: ImportPreviewSnapshot['needs_mapping'] = []

  for (const u of units) {
    if (!u.sku) {
      needsMapping.push({ name: u.name, reason: 'Producto sin SKU en WooCommerce' })
      continue
    }
    if ((seen.get(u.sku) ?? 0) > 1) {
      needsMapping.push({ name: u.name, reason: `SKU duplicado en WooCommerce (${u.sku})` })
      continue
    }
    if (erpSkus.has(u.sku)) matched.push({ sku: u.sku, name: u.name })
    else toImport.push({ sku: u.sku, name: u.name })
  }

  return { woo_total: units.length, matched, to_import: toImport, needs_mapping: needsMapping }
}

/** Dry-run reconciliation report for connecting an existing store. No writes. */
export async function previewImport(
  site: WoocommerceSite,
  opts: WoocommerceImportPreviewInput,
): Promise<ImportPreview> {
  const cacheKey = importPreviewCacheKey(site.org_id!, site.id)
  if (opts.refresh) invalidateImportPreviewSnapshot(cacheKey)

  let snapshot = getImportPreviewSnapshot(cacheKey)
  if (!snapshot) {
    snapshot = await buildImportPreviewSnapshot(site)
    setImportPreviewSnapshot(cacheKey, snapshot)
  }

  const sectionItems = snapshot[opts.section]
  const total = sectionItems.length
  const { offset, limit } = paginate(opts.page, opts.limit)
  const items = sectionItems.slice(offset, offset + limit)

  return {
    woo_total: snapshot.woo_total,
    matched_count: snapshot.matched.length,
    to_import_count: snapshot.to_import.length,
    needs_mapping_count: snapshot.needs_mapping.length,
    section: opts.section,
    items,
    page: opts.page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / opts.limit)),
  }
}

export interface OrderImportPreview {
  fetched_total: number
  to_import_count: number
  already_imported_count: number
  skipped_count: number
  open_orders_only: boolean
  section: WoocommerceOrderImportPreviewInput['section']
  items: OrderImportPreviewItem[]
  page: number
  limit: number
  total: number
  pages: number
}

function orderCustomerLabel(order: WooOrder): string {
  const billing = order.billing
  const name = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (billing?.email) return billing.email
  return 'Invitado'
}

function toOrderPreviewItem(order: WooOrder): OrderImportPreviewItem {
  return {
    woo_order_id: order.id,
    number: order.number ?? String(order.id),
    status: order.status,
    total: order.total ?? null,
    date: order.date_created ?? null,
    customer: orderCustomerLabel(order),
  }
}

function isEligibleOrderForBackfill(status: string): boolean {
  return OPEN_STATUSES.includes(status) || status === 'completed'
}

async function fetchOrdersForBackfillPreview(
  client: WooClient,
  openOrdersOnly: boolean,
  ordersSince?: string,
): Promise<WooOrder[]> {
  if (openOrdersOnly) {
    return (await Promise.all(
      OPEN_STATUSES.map((status) => client.listOrders({ status, after: ordersSince })),
    )).flat()
  }
  return client.listOrders({ after: ordersSince })
}

async function buildOrderImportPreviewSnapshot(
  site: WoocommerceSite,
  opts: Pick<WoocommerceOrderImportPreviewInput, 'open_orders_only' | 'orders_since'>,
): Promise<OrderImportPreviewSnapshot> {
  const client = buildClientForSite(site)
  const ordersSince = opts.orders_since ?? undefined
  const fetched = await fetchOrdersForBackfillPreview(client, opts.open_orders_only, ordersSince)

  const eligible = opts.open_orders_only
    ? fetched
    : fetched.filter((order) => isEligibleOrderForBackfill(order.status))

  const skipped = opts.open_orders_only
    ? []
    : fetched.filter((order) => !isEligibleOrderForBackfill(order.status)).map(toOrderPreviewItem)

  const importedIds = new Set<string>()
  if (eligible.length > 0) {
    const links = await WoocommerceOrderLink.findAll({
      where: {
        site_id: site.id,
        woo_order_id: { [Op.in]: eligible.map((order) => String(order.id)) },
      },
      attributes: ['woo_order_id', 'sales_order_id'],
    })

    const salesOrderIds = links
      .map((link) => link.sales_order_id)
      .filter((id): id is string => Boolean(id))

    if (salesOrderIds.length > 0) {
      const liveOrders = await SalesOrder.findAll({
        where: { org_id: site.org_id, id: { [Op.in]: salesOrderIds } },
        attributes: ['id'],
      })
      const liveSalesOrderIds = new Set(liveOrders.map((row) => row.id))
      for (const id of activeImportedWooOrderIds(links, liveSalesOrderIds)) {
        importedIds.add(id)
      }
    }
  }

  const toImport: OrderImportPreviewItem[] = []
  const alreadyImported: OrderImportPreviewItem[] = []
  for (const order of eligible) {
    const item = toOrderPreviewItem(order)
    if (importedIds.has(String(order.id))) alreadyImported.push(item)
    else toImport.push(item)
  }

  return {
    fetched_total: fetched.length,
    open_orders_only: opts.open_orders_only,
    to_import: toImport,
    already_imported: alreadyImported,
    skipped,
  }
}

/** Dry-run report for historical order backfill. No writes. */
export async function previewOrderImport(
  site: WoocommerceSite,
  opts: WoocommerceOrderImportPreviewInput,
): Promise<OrderImportPreview> {
  const cacheKey = orderImportPreviewCacheKey(
    site.org_id!,
    site.id,
    opts.open_orders_only,
    opts.orders_since ?? null,
  )
  if (opts.refresh) invalidateOrderImportPreviewSnapshots(site.org_id!, site.id)

  let snapshot = getOrderImportPreviewSnapshot(cacheKey)
  if (!snapshot) {
    snapshot = await buildOrderImportPreviewSnapshot(site, opts)
    setOrderImportPreviewSnapshot(cacheKey, snapshot)
  }

  const sectionItems = snapshot[opts.section]
  const total = sectionItems.length
  const { offset, limit } = paginate(opts.page, opts.limit)
  const items = sectionItems.slice(offset, offset + limit)

  return {
    fetched_total: snapshot.fetched_total,
    to_import_count: snapshot.to_import.length,
    already_imported_count: snapshot.already_imported.length,
    skipped_count: snapshot.skipped.length,
    open_orders_only: snapshot.open_orders_only,
    section: opts.section,
    items,
    page: opts.page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / opts.limit)),
  }
}

export interface ImportResult {
  products_linked: number
  products_imported: number
  orders_imported: number
  baseline: string
}

/** Applies the onboarding import: links/imports products, backfills orders, sets baseline. */
export async function applyImport(site: WoocommerceSite, options: WoocommerceImportApplyInput): Promise<ImportResult> {
  invalidateImportPreviewSnapshot(importPreviewCacheKey(site.org_id!, site.id))
  invalidateOrderImportPreviewSnapshots(site.org_id!, site.id)

  const client = buildClientForSite(site)
  const units = await collectUnits(client, await client.listProducts())

  const dupSkus = new Set<string>()
  const counts = new Map<string, number>()
  for (const u of units) if (u.sku) counts.set(u.sku, (counts.get(u.sku) ?? 0) + 1)
  for (const [sku, n] of counts) if (n > 1) dupSkus.add(sku)

  let linked = 0
  let imported = 0
  const actor = actorFor(site)

  for (const u of units) {
    if (!u.sku || dupSkus.has(u.sku)) continue

    let variant = await findOrRestoreVariantBySku(site.org_id!, u.sku)

    if (!variant) {
      if (!options.import_unmatched_products) continue
      const product = await Product.create({
        org_id: site.org_id,
        name: u.name,
        slug: slugForImportedProduct(u.name, String(u.wooProductId)),
        status: 'active',
        product_type: 'simple',
        import_source: 'woocommerce',
        import_external_id: String(u.wooProductId),
        created_by: actor,
        updated_by: actor,
      })
      variant = await ProductVariant.create({
        product_id: product.id,
        org_id: site.org_id,
        sku: u.sku,
        base_price: u.price ?? null,
        is_default: true,
        manage_stock: true,
        import_external_id: String(u.wooVariationId ?? u.wooProductId),
        created_by: actor,
        updated_by: actor,
      })
      imported += 1
    }

    const [, created] = await WoocommerceProductLink.findOrCreate({
      where: { site_id: site.id, variant_id: variant.id },
      defaults: {
        org_id: site.org_id!,
        site_id: site.id,
        variant_id: variant.id,
        woo_product_id: String(u.wooProductId),
        woo_variation_id: u.wooVariationId ? String(u.wooVariationId) : null,
      },
    })
    if (created) linked += 1
  }

  // --- Orders backfill ---
  let ordersImported = 0
  if (options.import_orders) {
    const after = options.orders_since ?? undefined
    const orders = options.open_orders_only
      ? (await Promise.all(OPEN_STATUSES.map((status) => client.listOrders({ status, after })))).flat()
      : await client.listOrders({ after })

    for (const order of orders) {
      const isOpen = OPEN_STATUSES.includes(order.status)
      const isCompleted = order.status === 'completed'
      if (!isOpen && !isCompleted) continue // skip cancelled/refunded history
      // Open orders still need fulfilling → deduct; completed already shipped → don't.
      await ingestWooOrder(site.id, order, { deductStock: isOpen })
      ordersImported += 1
    }
  }

  // --- Initial stock baseline ---
  if (options.stock_baseline === 'push_erp') {
    await pushAllStockForSite(site)
  } else if (options.stock_baseline === 'seed_from_woo') {
    await seedErpStockFromWoo(site, units)
  }

  logger.info({ siteId: site.id, linked, imported, ordersImported, baseline: options.stock_baseline }, 'woocommerce import applied')
  return { products_linked: linked, products_imported: imported, orders_imported: ordersImported, baseline: options.stock_baseline }
}

/**
 * Seeds ERP stock from Woo's current quantities. All adjustments run in a single
 * transaction (one round-trip group, not one per SKU) using `applyMovement`
 * directly so the inventory ledger stays consistent.
 */
async function seedErpStockFromWoo(site: WoocommerceSite, units: WooUnit[]): Promise<void> {
  const warehouseId = await resolveWarehouseForBranch(site.branch_id, site.org_id!)
  if (!warehouseId) return
  const actor = actorFor(site)

  await sequelize.transaction(async (t) => {
    for (const u of units) {
      if (!u.sku || u.stock === null) continue
      const variant = await ProductVariant.findOne({ where: { sku: u.sku, org_id: site.org_id }, attributes: ['id'], transaction: t })
      if (!variant) continue

      const [item] = await StockItem.findOrCreate({
        where: { variant_id: variant.id, warehouse_id: warehouseId },
        defaults: { variant_id: variant.id, warehouse_id: warehouseId, org_id: site.org_id!, quantity: '0' },
        transaction: t,
      })
      const delta = new Decimal(u.stock).minus(item.quantity)
      if (delta.isZero()) continue

      await applyMovement({
        variantId: variant.id,
        warehouseId,
        orgId: site.org_id!,
        movementType: 'adjustment',
        referenceType: 'manual',
        referenceId: null,
        quantityDelta: delta,
        notes: 'Stock inicial importado de WooCommerce',
        actorId: actor,
      }, t)
    }
  })
}
