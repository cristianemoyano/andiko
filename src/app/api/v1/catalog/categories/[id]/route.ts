import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { productCategoryUpdateSchema } from '@/modules/catalog/product-category.schema'
import { getCategory, updateCategory, deleteCategory } from '@/modules/catalog/product-category.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const category = await getCategory(id, tenantResult.ctx.orgId)
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

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const category = await updateCategory(id, parsed.data, resolveActorId(session), tenantResult.ctx.orgId)
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
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    await deleteCategory(id, resolveActorId(session), tenantResult.ctx.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json({ error: 'Categoría no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
