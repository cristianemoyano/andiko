import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { productLabelsQuerySchema } from '@/modules/catalog/product-labels.schema'
import { listProductLabels } from '@/modules/catalog/product-labels.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = productLabelsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const result = await listProductLabels(parsed.data, ctx)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
