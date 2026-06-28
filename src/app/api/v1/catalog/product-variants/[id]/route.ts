import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { productVariantUpdateSchema } from '@/modules/catalog/product-variant.schema'
import { updateProductVariant, deleteProductVariant } from '@/modules/catalog/product-variants.service'

type P = { id: string }

export const PATCH = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = productVariantUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const variant = await updateProductVariant(id, parsed.data, resolveActorId(session), ctxTenant)
    return NextResponse.json(variant)
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'VARIANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Variante no encontrada', code: 'NOT_FOUND' }, { status: 404 })
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
    await deleteProductVariant(id, resolveActorId(session), ctxTenant)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'VARIANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Variante no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

