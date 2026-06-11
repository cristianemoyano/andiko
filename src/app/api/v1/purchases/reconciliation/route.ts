import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { reconciliationQuerySchema } from '@/modules/purchases/purchase-reconciliation.schema'
import { listReconciliation } from '@/modules/purchases/purchase-reconciliation.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = reconciliationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const tenantCtx = await makeTenantContext(session.user)
    const result = await listReconciliation(parsed.data, tenantCtx)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
