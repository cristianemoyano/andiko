import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import { withPosDevice } from '@/lib/pos-auth'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'

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

  const variantWhere: Record<string, unknown> = { deleted_at: null }
  const productWhere: Record<string, unknown> = {
    org_id: ctx.orgId,
    status: 'active',
    deleted_at: null,
  }

  if (sinceDate) {
    productWhere['updated_at'] = { [Op.gt]: sinceDate }
  }

  const products = await Product.findAll({
    where: productWhere,
    attributes: ['id', 'name', 'iva_rate', 'status', 'updated_at'],
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        where: variantWhere,
        required: false,
        attributes: ['id', 'sku', 'barcode', 'name', 'base_price', 'is_default'],
      },
    ],
    limit: 5000,
  })

  const rows = products.flatMap((p) => {
    const variants = (p as unknown as { variants: ProductVariant[] }).variants ?? []
    return variants.map((v) => ({
      id: v.id,
      product_id: p.id,
      sku: v.sku,
      barcode: v.barcode,
      name: v.name ?? p.name,
      price: v.base_price,
      iva_rate: p.iva_rate,
      is_active: p.status === 'active',
      updated_at: (p.updated_at as unknown as Date).toISOString(),
    }))
  })

  return NextResponse.json({ data: rows, count: rows.length })
})
