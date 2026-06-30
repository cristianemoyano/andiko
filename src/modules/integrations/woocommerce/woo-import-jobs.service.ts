import 'server-only'
import Decimal from 'decimal.js'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from '@/modules/inventory/stock-item.model'
import { slugForImportedProduct } from '@/modules/catalog/product.utils'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import sequelize from '@/lib/db'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { buildClientForSite } from './woo-sites.service'
import { ingestWooOrder } from './woo-orders.service'
import { pushAllStockForSite } from './woo-resync.service'
import { upsertContactFromWooCustomer, customerEmail } from './woo-customers.service'
import { WOO_VARIATION_FETCH_CONCURRENCY } from './woo-import.constants'
import { findOrRestoreVariantBySku } from './woo-sync-links.service'
import type { WooClient, WooOrder, WooProduct } from './woo-client'

export interface WooUnit {
  sku: string | null
  name: string
  wooProductId: number
  wooVariationId: number | null
  price: string | null
  stock: number | null
}

export type ImportProductUnitResult = 'linked' | 'imported' | 'skipped'

function actorFor(site: WoocommerceSite): string {
  return site.created_by ?? site.org_id!
}

/** Flattens a store's catalog into sellable units (expanding variable products). */
export async function collectUnits(client: WooClient, products: WooProduct[]): Promise<WooUnit[]> {
  const units: WooUnit[] = []

  for (const p of products) {
    if (p.type !== 'variable' || !p.variations || p.variations.length === 0) {
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

  const variableProducts = products.filter(
    (p) => p.type === 'variable' && p.variations && p.variations.length > 0,
  )

  for (let i = 0; i < variableProducts.length; i += WOO_VARIATION_FETCH_CONCURRENCY) {
    const batch = variableProducts.slice(i, i + WOO_VARIATION_FETCH_CONCURRENCY)
    const batchUnits = await Promise.all(batch.map(async (p) => {
      const variations = await client.listVariations(p.id)
      return variations.map((v) => ({
        sku: v.sku ?? null,
        name: `${p.name}${v.name ? ` - ${v.name}` : ''}`,
        wooProductId: p.id,
        wooVariationId: v.id,
        price: v.regular_price ?? null,
        stock: v.stock_quantity ?? null,
      }))
    }))
    for (const group of batchUnits) units.push(...group)
  }

  return units
}

export function duplicateSkusFromUnits(units: WooUnit[]): Set<string> {
  const counts = new Map<string, number>()
  for (const u of units) if (u.sku) counts.set(u.sku, (counts.get(u.sku) ?? 0) + 1)
  const dup = new Set<string>()
  for (const [sku, n] of counts) if (n > 1) dup.add(sku)
  return dup
}

export function importableProductUnits(units: WooUnit[]): WooUnit[] {
  const dupSkus = duplicateSkusFromUnits(units)
  return units.filter((u) => u.sku && !dupSkus.has(u.sku))
}

/** Links or imports one Woo sellable unit into the ERP. */
export async function importProductUnit(
  site: WoocommerceSite,
  unit: WooUnit,
  importUnmatchedProducts: boolean,
): Promise<ImportProductUnitResult> {
  if (!unit.sku) return 'skipped'

  let variant = await findOrRestoreVariantBySku(site.org_id!, unit.sku)
  const actor = actorFor(site)

  if (!variant) {
    if (!importUnmatchedProducts) return 'skipped'
    const product = await Product.create({
      org_id: site.org_id,
      name: unit.name,
      slug: slugForImportedProduct(unit.name, String(unit.wooProductId)),
      status: 'active',
      product_type: 'simple',
      import_source: 'woocommerce',
      import_external_id: String(unit.wooProductId),
      created_by: actor,
      updated_by: actor,
    })
    variant = await ProductVariant.create({
      product_id: product.id,
      org_id: site.org_id,
      sku: unit.sku,
      base_price: unit.price ?? null,
      is_default: true,
      manage_stock: true,
      import_external_id: String(unit.wooVariationId ?? unit.wooProductId),
      created_by: actor,
      updated_by: actor,
    })
    await WoocommerceProductLink.findOrCreate({
      where: { site_id: site.id, variant_id: variant.id },
      defaults: {
        org_id: site.org_id!,
        site_id: site.id,
        variant_id: variant.id,
        woo_product_id: String(unit.wooProductId),
        woo_variation_id: unit.wooVariationId ? String(unit.wooVariationId) : null,
      },
    })
    return 'imported'
  }

  const [, created] = await WoocommerceProductLink.findOrCreate({
    where: { site_id: site.id, variant_id: variant.id },
    defaults: {
      org_id: site.org_id!,
      site_id: site.id,
      variant_id: variant.id,
      woo_product_id: String(unit.wooProductId),
      woo_variation_id: unit.wooVariationId ? String(unit.wooVariationId) : null,
    },
  })

  const externalId = String(unit.wooVariationId ?? unit.wooProductId)
  if (!variant.import_external_id) {
    await variant.update({ import_external_id: externalId, updated_by: actor })
  }
  const product = await Product.findByPk(variant.product_id)
  if (product && !product.import_source) {
    await product.update({
      import_source: 'woocommerce',
      import_external_id: String(unit.wooProductId),
      updated_by: actor,
    })
  }

  return created ? 'linked' : 'skipped'
}

const OPEN_STATUSES = ['pending', 'processing', 'on-hold']

export function isEligibleOrderForBackfill(status: string): boolean {
  return OPEN_STATUSES.includes(status) || status === 'completed'
}

export async function fetchOrdersForImport(
  site: WoocommerceSite,
  openOrdersOnly: boolean,
  ordersSince?: string,
): Promise<WooOrder[]> {
  const client = buildClientForSite(site)
  if (openOrdersOnly) {
    return (await Promise.all(
      OPEN_STATUSES.map((status) => client.listOrders({ status, after: ordersSince })),
    )).flat()
  }
  const orders = await client.listOrders({ after: ordersSince })
  return orders.filter((order) => isEligibleOrderForBackfill(order.status))
}

export async function importOrderFromWoo(
  site: WoocommerceSite,
  order: WooOrder,
): Promise<'imported' | 'skipped'> {
  const isOpen = OPEN_STATUSES.includes(order.status)
  await ingestWooOrder(site.id, order, { deductStock: isOpen })
  return 'imported'
}

export async function importCustomerFromWooById(
  site: WoocommerceSite,
  wooCustomerId: number,
): Promise<'created' | 'linked' | 'already_linked' | 'skipped'> {
  const client = buildClientForSite(site)
  const customer = await client.getCustomer(wooCustomerId)
  if (!customerEmail(customer)) return 'skipped'
  const result = await upsertContactFromWooCustomer(site, customer)
  if (result.created) return 'created'
  if (result.linked) return 'linked'
  return 'already_linked'
}

export async function runStockBaselineForSite(
  site: WoocommerceSite,
  mode: 'push_erp' | 'seed_from_woo',
): Promise<void> {
  if (mode === 'push_erp') {
    await pushAllStockForSite(site)
    return
  }
  const client = buildClientForSite(site)
  const units = await collectUnits(client, await client.listProducts())
  await seedErpStockFromWoo(site, units)
}

async function seedErpStockFromWoo(site: WoocommerceSite, units: WooUnit[]): Promise<void> {
  const warehouseId = await resolveWarehouseForBranch(site.branch_id, site.org_id!)
  if (!warehouseId) return
  const actor = actorFor(site)

  await sequelize.transaction(async (t) => {
    for (const u of units) {
      if (!u.sku || u.stock === null) continue
      const variant = await ProductVariant.findOne({
        where: { sku: u.sku, org_id: site.org_id },
        attributes: ['id'],
        transaction: t,
      })
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

export type ImportJobStep = 'product_unit' | 'order' | 'customer' | 'stock_baseline'

export async function processImportJob(
  site: WoocommerceSite,
  payload: Record<string, unknown>,
): Promise<void> {
  const step = payload.step as ImportJobStep

  if (step === 'product_unit') {
    const unit = payload.unit as WooUnit
    const importUnmatched = payload.import_unmatched_products === true
    await importProductUnit(site, unit, importUnmatched)
    return
  }

  if (step === 'order') {
    const wooOrderId = Number(payload.woo_order_id)
    const client = buildClientForSite(site)
    const order = await client.getOrder(wooOrderId)
    await importOrderFromWoo(site, order)
    return
  }

  if (step === 'customer') {
    const wooCustomerId = Number(payload.woo_customer_id)
    await importCustomerFromWooById(site, wooCustomerId)
    return
  }

  if (step === 'stock_baseline') {
    const mode = payload.mode as 'push_erp' | 'seed_from_woo'
    await runStockBaselineForSite(site, mode)
  }
}
