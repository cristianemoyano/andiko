import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { accountStatementSummaryListQuerySchema } from '@/modules/sales/account-statement.schema'
import { listAccountStatementSummaries } from '@/modules/sales/account-statement-summaries.service'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = accountStatementSummaryListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const result = await listAccountStatementSummaries(parsed.data, tenantCtx)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
