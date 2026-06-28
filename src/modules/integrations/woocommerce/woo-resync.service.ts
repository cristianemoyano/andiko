import 'server-only'
import ProductVariant from '@/modules/catalog/product-variant.model'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { enqueue } from './woo-queue'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Manual catalog resync (ERP → Woo): enqueues publish jobs for every variant in
 * the org. Service products are skipped by the worker. Returns the count queued.
 */
export async function publishAllVariantsForSite(site: WoocommerceSite): Promise<{ queued: number }> {
  const variants = await ProductVariant.findAll({
    where: { org_id: site.org_id },
    attributes: ['id'],
  })
  const ids = variants.map((v) => v.id)
  for (const batch of chunk(ids, 50)) {
    await enqueue({ orgId: site.org_id!, siteId: site.id, kind: 'product', payload: { variant_ids: batch } })
  }
  return { queued: ids.length }
}

/**
 * Manual stock resync (ERP → Woo): enqueues a stock push for every variant
 * already linked to this site. Used by onboarding's "push ERP baseline" option
 * and as a self-healing reconciliation.
 */
export async function pushAllStockForSite(site: WoocommerceSite): Promise<{ queued: number }> {
  const links = await WoocommerceProductLink.findAll({
    where: { site_id: site.id },
    attributes: ['variant_id'],
  })
  for (const link of links) {
    await enqueue({ orgId: site.org_id!, siteId: site.id, kind: 'stock', payload: { variant_id: link.variant_id } })
  }
  return { queued: links.length }
}
