import 'server-only'
import { Op } from 'sequelize'
import Product from './product.model'
import ProductVariant from './product-variant.model'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereOrg } from '@/lib/tenancy'
import type { TenantContext } from '@/lib/tenancy'
import type { ProductLabelsQuery } from './product-labels.schema'

export type ProductLabelRow = {
  variant_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  barcode: string | null
  price: string | null
}

export async function listProductLabels(query: ProductLabelsQuery, ctx: TenantContext) {
  const { page, limit, search, category_id } = query
  const { offset } = paginate(page, limit)

  const productWhere: Record<string, unknown> = {
    ...whereOrg(ctx),
    status: 'active',
  }
  if (category_id) productWhere.category_id = category_id

  const variantWhere: Record<string, unknown> = whereOrg(ctx)
  if (search?.trim()) {
    const term = `%${search.trim()}%`
    variantWhere[Op.or as unknown as string] = [
      { sku: { [Op.iLike]: term } },
      { barcode: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { '$product.name$': { [Op.iLike]: term } },
    ]
  }

  const { rows, count } = await ProductVariant.findAndCountAll({
    where: variantWhere,
    limit,
    offset,
    distinct: true,
    subQuery: false,
    order: [
      [{ model: Product, as: 'product' }, 'name', 'ASC'],
      ['is_default', 'DESC'],
      ['sku', 'ASC'],
    ],
    attributes: ['id', 'sku', 'barcode', 'name', 'base_price', 'is_default'],
    include: [{
      model: Product,
      as: 'product',
      required: true,
      where: productWhere,
      attributes: ['id', 'name'],
    }],
  })

  const data: ProductLabelRow[] = rows.map((variant) => {
    const product = variant.get('product') as Product
    const variantName =
      variant.name && variant.name !== product.name ? variant.name : null
    return {
      variant_id: variant.id,
      product_name: product.name,
      variant_name: variantName,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.base_price,
    }
  })

  return toPaginated(data, count, page, limit)
}
