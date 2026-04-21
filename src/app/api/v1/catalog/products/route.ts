import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { productSchema, productQuerySchema } from '@/modules/catalog/product.schema'
import { listProducts, createProduct } from '@/modules/catalog/products.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = productQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listProducts(parsed.data, session.user.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const product = await createProduct(parsed.data, session.user.id!, session.user.orgId)
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El SKU ya existe', code: 'DUPLICATE_SKU' }, { status: 409 })
    }
    throw err
  }
})
