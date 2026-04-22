import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import Product from './product.model'
import ProductCategory from './product-category.model'
import ProductVariant from './product-variant.model'
import { generateSlug, formatSku } from './product.utils'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { ProductInput, ProductUpdateInput, ProductQuery } from './product.schema'
import type { UUID } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'

export async function listProducts(query: ProductQuery, ctx: TenantContext) {
  const { page, limit, search, category_id, status, product_type } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereOrg(ctx)
  if (status)       where.status       = status
  if (product_type) where.product_type = product_type
  if (category_id)  where.category_id  = category_id
  if (search) {
    where[Op.or as unknown as string] = [
      { name:   { [Op.iLike]: `%${search}%` } },
      { vendor: { [Op.iLike]: `%${search}%` } },
      // allow SKU search (joined via variants)
      { '$variants.sku$': { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    distinct: true,
    // Needed when filtering by joined columns (e.g. variants.sku).
    // Otherwise Sequelize places the WHERE in a subquery that doesn't include the JOIN.
    subQuery: false,
    attributes: ['id', 'name', 'slug', 'product_type', 'status', 'iva_rate', 'unit_of_measure', 'vendor', 'category_id', 'created_at'],
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        where: { is_default: true },
        required: false,
        attributes: ['id', 'sku', 'base_price', 'stock_quantity', 'manage_stock'],
      },
      {
        model: ProductCategory,
        as: 'category',
        required: false,
        attributes: ['id', 'name'],
      },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getProduct(id: UUID, ctx: TenantContext) {
  const product = await Product.findOne({
    where: whereOrg(ctx, { id }),
    include: [
      { model: ProductVariant, as: 'variants', attributes: { exclude: ['created_by', 'updated_by', 'deleted_by'] } },
      { model: ProductCategory, as: 'category', required: false, attributes: ['id', 'name'] },
    ],
  })
  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  return product
}

export async function createProduct(input: ProductInput, actorId: UUID, ctx: TenantContext) {
  const { sku, barcode, cost_price, base_price, manage_stock, stock_quantity, ...productData } = input

  return sequelize.transaction(async (t) => {
    const slug = generateSlug(productData.name)

    const product = await Product.create(
      { ...productData, slug, org_id: ctx.orgId, created_by: actorId, updated_by: actorId },
      { transaction: t }
    )

    await ProductVariant.create(
      {
        product_id:     product.id,
        org_id:         ctx.orgId,
        sku:            formatSku(sku),
        barcode:        barcode ?? null,
        is_default:     true,
        cost_price:     cost_price ?? null,
        base_price:     base_price ?? null,
        manage_stock:   manage_stock ?? true,
        stock_quantity: stock_quantity ?? 0,
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t }
    )

    logger.info({ productId: product.id, actorId }, 'product created')
    return product
  })
}

export async function updateProduct(id: UUID, input: ProductUpdateInput, actorId: UUID, ctx: TenantContext) {
  const product = await getProduct(id, ctx)

  const { sku, barcode, cost_price, base_price, stock_quantity, manage_stock, ...productData } = input

  await sequelize.transaction(async (t) => {
    if (Object.keys(productData).length > 0) {
      const slug = productData.name ? generateSlug(productData.name) : undefined
      await product.update(
        { ...productData, ...(slug ? { slug } : {}), updated_by: actorId },
        { transaction: t }
      )
    }

    const variantUpdates: Record<string, unknown> = {}
    if (sku !== undefined)            variantUpdates.sku            = formatSku(sku)
    if (barcode !== undefined)        variantUpdates.barcode        = barcode
    if (cost_price !== undefined)     variantUpdates.cost_price     = cost_price
    if (base_price !== undefined)     variantUpdates.base_price     = base_price
    if (stock_quantity !== undefined) variantUpdates.stock_quantity = stock_quantity
    if (manage_stock !== undefined)   variantUpdates.manage_stock   = manage_stock

    if (Object.keys(variantUpdates).length > 0) {
      await ProductVariant.update(
        { ...variantUpdates, updated_by: actorId },
        { where: { product_id: id, is_default: true, org_id: ctx.orgId }, transaction: t }
      )
    }
  })

  logger.info({ productId: id, actorId }, 'product updated')
  return getProduct(id, ctx)
}

export async function deleteProduct(id: UUID, actorId: UUID, ctx: TenantContext) {
  const product = await getProduct(id, ctx)
  await sequelize.transaction(async (t) => {
    await ProductVariant.update({ deleted_by: actorId }, { where: { product_id: id, org_id: ctx.orgId }, transaction: t })
    await ProductVariant.destroy({ where: { product_id: id, org_id: ctx.orgId }, transaction: t })
    await product.update({ deleted_by: actorId }, { transaction: t })
    await product.destroy({ transaction: t })
  })
  logger.info({ productId: id, actorId }, 'product deleted')
}
