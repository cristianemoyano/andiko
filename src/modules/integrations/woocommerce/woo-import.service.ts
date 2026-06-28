import 'server-only'
import Decimal from 'decimal.js'
import logger from '@/lib/logger'
import sequelize from '@/lib/db'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from '@/modules/inventory/stock-item.model'
import { slugForImportedProduct } from '@/modules/catalog/product.utils'
import { resolveDefaultWarehouse } from '@/modules/inventory/warehouses.service'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { buildClientForSite } from './woo-sites.service'
import { ingestWooOrder } from './woo-orders.service'
import { pushAllStockForSite } from './woo-resync.service'
import type { WoocommerceImportApplyInput } from './woocommerce.schema'
import type { WooClient, WooProduct } from './woo-client'

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
  matched: { sku: string; name: string }[]
  to_import: { sku: string; name: string }[]
  needs_mapping: { name: string; reason: string }[]
}

/** Dry-run reconciliation report for connecting an existing store. No writes. */
export async function previewImport(site: WoocommerceSite): Promise<ImportPreview> {
  const client = buildClientForSite(site)
  const units = await collectUnits(client, await client.listProducts())

  const seen = new Map<string, number>()
  for (const u of units) if (u.sku) seen.set(u.sku, (seen.get(u.sku) ?? 0) + 1)

  const matched: { sku: string; name: string }[] = []
  const toImport: { sku: string; name: string }[] = []
  const needsMapping: { name: string; reason: string }[] = []

  for (const u of units) {
    if (!u.sku) {
      needsMapping.push({ name: u.name, reason: 'Producto sin SKU en WooCommerce' })
      continue
    }
    if ((seen.get(u.sku) ?? 0) > 1) {
      needsMapping.push({ name: u.name, reason: `SKU duplicado en WooCommerce (${u.sku})` })
      continue
    }
    const variant = await ProductVariant.findOne({ where: { sku: u.sku, org_id: site.org_id }, attributes: ['id'] })
    if (variant) matched.push({ sku: u.sku, name: u.name })
    else toImport.push({ sku: u.sku, name: u.name })
  }

  return { woo_total: units.length, matched, to_import: toImport, needs_mapping: needsMapping }
}

export interface ImportResult {
  products_linked: number
  products_imported: number
  orders_imported: number
  baseline: string
}

/** Applies the onboarding import: links/imports products, backfills orders, sets baseline. */
export async function applyImport(site: WoocommerceSite, options: WoocommerceImportApplyInput): Promise<ImportResult> {
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

    let variant = await ProductVariant.findOne({ where: { sku: u.sku, org_id: site.org_id } })

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
  const warehouseId = await resolveDefaultWarehouse(site.branch_id, site.org_id!)
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
