import 'server-only'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import ProductVariant from './product-variant.model'
import Product from './product.model'
import { whereOrg } from '@/lib/tenancy'
import type { TenantContext } from '@/lib/tenancy'
import type { UUID } from '@/types'
import { formatSku } from './product.utils'
import logger from '@/lib/logger'
import type { ProductVariantInput, ProductVariantUpdateInput } from './product-variant.schema'

export async function createProductVariant(input: ProductVariantInput, actorId: UUID, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const product = await Product.findOne({ where: whereOrg(ctx, { id: input.product_id }), transaction: t })
    if (!product) throw new Error('PRODUCT_NOT_FOUND')

    const created = await ProductVariant.create(
      {
        product_id: input.product_id,
        org_id: ctx.orgId,
        sku: formatSku(input.sku),
        name: input.name ?? null,
        barcode: input.barcode ?? null,
        cost_price: input.cost_price ?? null,
        base_price: input.base_price ?? null,
        manage_stock: input.manage_stock ?? true,
        stock_quantity: input.stock_quantity ?? 0,
        is_default: input.is_default ?? false,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    logger.info({ variantId: created.id, productId: input.product_id, actorId }, 'product variant created')
    await enqueueWoocommercePublish(ctx.orgId, created.id, t)
    return created
  })
}

export async function updateProductVariant(id: UUID, input: ProductVariantUpdateInput, actorId: UUID, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const variant = await ProductVariant.findOne({ where: whereOrg(ctx, { id }), transaction: t })
    if (!variant) throw new Error('VARIANT_NOT_FOUND')

    const payload: Record<string, unknown> = { updated_by: actorId }
    if (input.sku !== undefined) payload.sku = formatSku(input.sku)
    if (input.name !== undefined) payload.name = input.name
    if (input.barcode !== undefined) payload.barcode = input.barcode
    if (input.cost_price !== undefined) payload.cost_price = input.cost_price
    if (input.base_price !== undefined) payload.base_price = input.base_price
    if (input.manage_stock !== undefined) payload.manage_stock = input.manage_stock
    if (input.stock_quantity !== undefined) payload.stock_quantity = input.stock_quantity

    await variant.update(payload as Parameters<typeof variant.update>[0], { transaction: t })
    logger.info({ variantId: id, actorId }, 'product variant updated')
    await enqueueWoocommercePublish(ctx.orgId, variant.id, t)
    return variant
  })
}

/**
 * Best-effort: enqueue a WooCommerce catalog publish for this variant on any
 * auto-publishing site. Runs inside the caller's transaction (transactional
 * outbox) and never blocks the catalog write if the integration is absent.
 */
async function enqueueWoocommercePublish(orgId: string, variantId: UUID, t: Transaction): Promise<void> {
  try {
    const mod = await import('@/modules/integrations/woocommerce/woo-catalog.service')
    await mod.enqueueProductSync(orgId, [variantId], t)
  } catch (err) {
    logger.warn({ variantId, err: String(err) }, 'woocommerce publish enqueue skipped')
  }
}

export async function deleteProductVariant(id: UUID, actorId: UUID, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const variant = await ProductVariant.findOne({ where: whereOrg(ctx, { id }), transaction: t })
    if (!variant) throw new Error('VARIANT_NOT_FOUND')
    await variant.update({ deleted_by: actorId } as Parameters<typeof variant.update>[0], { transaction: t })
    await variant.destroy({ transaction: t })
    logger.info({ variantId: id, actorId }, 'product variant deleted')
  })
}

