import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { productCategoryUpdateSchema } from '@/modules/catalog/product-category.schema'
import { getCategory, updateCategory, deleteCategory } from '@/modules/catalog/product-category.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const category = await getCategory(id, session.user.orgId)
    return NextResponse.json(category)
  } catch {
    return NextResponse.json({ error: 'Categoría no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = productCategoryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const category = await updateCategory(id, parsed.data, session.user.id!, session.user.orgId)
    return NextResponse.json(category)
  } catch (err) {
    if (err instanceof Error && err.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json({ error: 'Categoría no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('products:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteCategory(id, session.user.id!, session.user.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json({ error: 'Categoría no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
