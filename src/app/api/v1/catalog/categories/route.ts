import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { productCategorySchema, productCategoryQuerySchema } from '@/modules/catalog/product-category.schema'
import { listCategories, createCategory } from '@/modules/catalog/product-category.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = productCategoryQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listCategories(parsed.data, session.user.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = productCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const category = await createCategory(parsed.data, session.user.id!, session.user.orgId)
  return NextResponse.json(category, { status: 201 })
})
