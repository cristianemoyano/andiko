import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import StockItem from '@/modules/inventory/stock-item.model'
import { resolveDefaultWarehouse } from '@/modules/inventory/warehouses.service'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { buildClientForSite } from './woo-sites.service'
import { enqueue } from './woo-queue'

/**
 * Enqueues a stock push to every active site that shares the warehouse a
 * movement just touched (i.e. whose linked branch resolves to that warehouse).
 * Called best-effort from `applyMovement`, inside the caller's transaction.
 */
export async function enqueueStockSync(
  variantId: string,
  warehouseId: string,
  orgId: string,
  t: Transaction,
): Promise<void> {
  const sites = await WoocommerceSite.findAll({
    where: { org_id: orgId, is_active: true },
    attributes: ['id', 'org_id', 'branch_id'],
    transaction: t,
  })
  for (const site of sites) {
    const siteWarehouse = await resolveDefaultWarehouse(site.branch_id, orgId, t)
    if (siteWarehouse !== warehouseId) continue
    await enqueue({ orgId, siteId: site.id, kind: 'stock', payload: { variant_id: variantId }, t })
  }
}

/**
 * Computes the quantity to publish for a variant on a site: the authoritative
 * stock in the site's branch warehouse, minus the site's safety buffer, floored
 * at zero and rounded down to a whole unit (avoids overselling fractional stock).
 */
export async function computeAvailableForSite(site: WoocommerceSite, variantId: string): Promise<number> {
  const warehouseId = await resolveDefaultWarehouse(site.branch_id, site.org_id!)
  if (!warehouseId) return 0
  const total = (await StockItem.sum('quantity', {
    where: { variant_id: variantId, warehouse_id: warehouseId },
  })) as number | null
  const buffer = new Decimal(site.stock_safety_buffer || '0')
  const available = new Decimal(total ?? 0).minus(buffer)
  return Math.max(0, Math.floor(available.toNumber()))
}

/** Pushes the current available stock for a variant to a site's linked Woo product. */
export async function pushVariantStock(site: WoocommerceSite, variantId: string): Promise<void> {
  const link = await WoocommerceProductLink.findOne({
    where: { site_id: site.id, variant_id: variantId },
  })
  if (!link) return // not published to this site yet

  const available = await computeAvailableForSite(site, variantId)
  const client = buildClientForSite(site)
  await client.setStock(
    Number(link.woo_product_id),
    link.woo_variation_id ? Number(link.woo_variation_id) : null,
    available,
  )
  await link.update({ last_pushed_at: new Date() })
  await site.update({ last_stock_pushed_at: new Date() })
  logger.info({ siteId: site.id, variantId, available }, 'woocommerce stock pushed')
}

/** Worker handler for a 'stock' job. */
export async function processStockJob(site: WoocommerceSite, payload: Record<string, unknown>): Promise<void> {
  const variantId = typeof payload.variant_id === 'string' ? payload.variant_id : null
  if (!variantId) return
  await pushVariantStock(site, variantId)
}
