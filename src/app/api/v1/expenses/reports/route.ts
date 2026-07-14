import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { expensesReportQuerySchema } from '@/modules/expenses/expenses-reports.schema'
import { getExpensesReport } from '@/modules/expenses/expenses-reports.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = expensesReportQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  const report = await getExpensesReport(parsed.data, orgScope.orgId)
  return NextResponse.json(report)
})
