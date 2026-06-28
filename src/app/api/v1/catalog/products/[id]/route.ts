import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { productUpdateSchema } from '@/modules/catalog/product.schema'
import { getProduct, updateProduct, deleteProduct } from '@/modules/catalog/products.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const product = await getProduct(id, ctxTenant)
    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = productUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const product = await updateProduct(id, parsed.data, resolveActorId(session), ctxTenant)
    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'PLU_CODE_TAKEN') {
      return NextResponse.json({ error: 'El código PLU ya está en uso', code: 'PLU_CODE_TAKEN' }, { status: 409 })
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El SKU ya existe', code: 'DUPLICATE_SKU' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('products:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    await deleteProduct(id, resolveActorId(session), ctxTenant)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
