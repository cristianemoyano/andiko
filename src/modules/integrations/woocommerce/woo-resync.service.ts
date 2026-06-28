import 'server-only'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { createImportProgressReporter, type ImportProgressCallback } from '@/lib/import-progress'
import { publishVariant } from './woo-catalog.service'
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

export interface PublishCatalogProgressResult {
  published: number
  skipped: number
  errors: { row: number; message: string }[]
}

/**
 * Manual catalog resync with live progress (ERP → Woo). Publishes each variant
 * directly to WooCommerce — used by the streaming publish endpoint in the UI.
 */
export async function publishAllVariantsForSiteWithProgress(
  site: WoocommerceSite,
  onProgress?: ImportProgressCallback,
): Promise<PublishCatalogProgressResult> {
  const variants = await ProductVariant.findAll({
    where: { org_id: site.org_id },
    include: [{
      model: Product,
      as: 'product',
      required: true,
      attributes: ['id', 'name', 'description', 'status', 'product_type'],
    }],
    order: [['sku', 'ASC'], ['id', 'ASC']],
  })

  const progress = createImportProgressReporter(variants.length, onProgress)
  let published = 0
  let skipped = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i]!
    const product = variant.get('product') as Product | undefined
    const row = i + 1
    try {
      if (!product || product.product_type === 'service') {
        skipped += 1
        continue
      }
      await publishVariant(site, variant, product)
      published += 1
    } catch (err) {
      const label = variant.sku ?? variant.id
      errors.push({ row, message: `${label}: ${String(err)}`.slice(0, 500) })
    } finally {
      progress.tick(row)
    }
  }

  progress.finish()
  return { published, skipped, errors }
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
