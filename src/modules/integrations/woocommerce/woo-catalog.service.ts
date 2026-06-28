import 'server-only'
import { createHash } from 'node:crypto'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import PriceListItem from '@/modules/catalog/price-list-item.model'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceProductLink from './woocommerce-product-link.model'
import { buildClientForSite } from './woo-sites.service'
import { enqueue } from './woo-queue'

/** Resolves the price to publish for a variant on a site (price list → base price). */
export async function resolveVariantPrice(site: WoocommerceSite, variant: ProductVariant): Promise<string> {
  if (site.price_list_id) {
    const item = await PriceListItem.findOne({
      where: { price_list_id: site.price_list_id, product_variant_id: variant.id },
      attributes: ['price'],
      order: [['valid_from', 'DESC']],
    })
    if (item) return item.price
  }
  return variant.base_price ?? '0'
}

/**
 * Publishes one ERP variant to a site as a WooCommerce simple product (one Woo
 * product per variant, keyed by SKU). Creates or updates depending on whether a
 * link already exists, and records the link + a content hash to skip no-op pushes.
 */
export async function publishVariant(
  site: WoocommerceSite,
  variant: ProductVariant,
  product: Product,
): Promise<void> {
  const client = buildClientForSite(site)
  const price = await resolveVariantPrice(site, variant)

  const payload: Record<string, unknown> = {
    name: variant.name ? `${product.name} - ${variant.name}` : product.name,
    type: 'simple',
    sku: variant.sku,
    regular_price: price,
    description: product.description ?? '',
    manage_stock: variant.manage_stock,
    status: product.status === 'active' ? 'publish' : 'draft',
  }

  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')

  const link = await WoocommerceProductLink.findOne({
    where: { site_id: site.id, variant_id: variant.id },
  })

  if (link) {
    if (link.last_pushed_hash === hash) return
    await client.updateProduct(Number(link.woo_product_id), payload)
    await link.update({ last_pushed_hash: hash, last_pushed_at: new Date() })
    return
  }

  const created = await client.createProduct(payload)
  await WoocommerceProductLink.create({
    org_id: site.org_id!,
    site_id: site.id,
    variant_id: variant.id,
    woo_product_id: String(created.id),
    woo_variation_id: null,
    last_pushed_hash: hash,
    last_pushed_at: new Date(),
  })
}

/**
 * Enqueues a catalog publish for the given variants to every active
 * auto-publishing site in the org. Called (best-effort) from the catalog
 * product/variant services after a create/update.
 */
export async function enqueueProductSync(
  orgId: string,
  variantIds: string[],
  t?: Transaction,
): Promise<void> {
  if (variantIds.length === 0) return
  const sites = await WoocommerceSite.findAll({
    where: { org_id: orgId, is_active: true, auto_publish: true },
    attributes: ['id', 'org_id'],
    transaction: t,
  })
  for (const site of sites) {
    await enqueue({ orgId, siteId: site.id, kind: 'product', payload: { variant_ids: variantIds }, t })
  }
}

/** Worker handler: publishes every variant referenced by a 'product' job. */
export async function processProductJob(site: WoocommerceSite, payload: Record<string, unknown>): Promise<void> {
  const variantIds = Array.isArray(payload.variant_ids) ? (payload.variant_ids as string[]) : []
  for (const variantId of variantIds) {
    const variant = await ProductVariant.findOne({ where: { id: variantId, org_id: site.org_id } })
    if (!variant) continue
    const product = await Product.findByPk(variant.product_id)
    if (!product || product.product_type === 'service') continue
    await publishVariant(site, variant, product)
    logger.info({ siteId: site.id, variantId }, 'woocommerce product published')
  }
}
