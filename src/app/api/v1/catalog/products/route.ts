import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { productSchema, productQuerySchema } from '@/modules/catalog/product.schema'
import { listProducts, createProduct } from '@/modules/catalog/products.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = productQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const result = await listProducts(parsed.data, ctxTenant)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const product = await createProduct(parsed.data, resolveActorId(session), ctxTenant)
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
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
