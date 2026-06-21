import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op, type WhereOptions } from 'sequelize'
import { withPosDevice } from '@/lib/pos-auth'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import PriceList from '@/modules/catalog/price-list.model'
import PriceListItem from '@/modules/catalog/price-list-item.model'

const querySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  branch_id: z.string().uuid().optional(),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { since } = parsed.data
  const sinceDate = since ? new Date(since) : null

  const variantWhere: WhereOptions = { deleted_at: null }
  const baseProductWhere: WhereOptions = {
    org_id: ctx.orgId,
    status: 'active',
    deleted_at: null,
  }

  let productWhere: WhereOptions = baseProductWhere

  if (sinceDate) {
    const variantRows = await ProductVariant.findAll({
      where: {
        org_id: ctx.orgId,
        deleted_at: null,
        updated_at: { [Op.gt]: sinceDate },
      },
      attributes: ['product_id'],
      raw: true,
    })
    const variantProductIds = [...new Set(variantRows.map((v) => v.product_id as string))]
    productWhere = {
      ...baseProductWhere,
      [Op.or]: [
        { updated_at: { [Op.gt]: sinceDate } },
        ...(variantProductIds.length ? [{ id: { [Op.in]: variantProductIds } }] : []),
      ],
    }
  }

  const products = await Product.findAll({
    where: productWhere,
    attributes: ['id', 'name', 'iva_rate', 'status', 'images', 'updated_at'],
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        where: variantWhere,
        required: false,
        attributes: ['id', 'sku', 'barcode', 'name', 'base_price', 'is_default', 'sold_by_weight', 'plu_code'],
        include: [
          {
            model: PriceListItem,
            as: 'price_list_items',
            required: false,
            attributes: ['price'],
            where: { deleted_at: null },
            include: [
              {
                model: PriceList,
                as: 'price_list',
                required: true,
                attributes: [],
                where: { org_id: ctx.orgId, is_default: true, is_active: true, deleted_at: null },
              },
            ],
          },
        ],
      },
    ],
    limit: 5000,
  })

  const rows = products.flatMap((p) => {
    const variants = (p as unknown as { variants: (ProductVariant & { price_list_items: PriceListItem[] })[] }).variants ?? []
    const images = (p as unknown as { images: Array<{ url: string }> }).images ?? []
    const imageUrl = images[0]?.url ?? null
    return variants.map((v) => ({
      id: v.id,
      product_id: p.id,
      sku: v.sku,
      barcode: v.barcode,
      name: v.name ?? p.name,
      price: v.price_list_items?.[0]?.price ?? v.base_price,
      iva_rate: p.iva_rate,
      is_active: p.status === 'active',
      image_url: imageUrl,
      sold_by_weight: v.sold_by_weight,
      plu_code: v.plu_code,
      updated_at: (p.updated_at as unknown as Date).toISOString(),
    }))
  })

  return NextResponse.json({ data: rows, count: rows.length })
})
