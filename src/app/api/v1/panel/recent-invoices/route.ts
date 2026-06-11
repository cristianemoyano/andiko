import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { getPanelRecentInvoices, type PanelFilters, type PanelPeriod } from '@/modules/panel/panel.service'

const VALID_PERIODS: PanelPeriod[] = ['last_week', 'last_month', 'last_3months', 'last_year', 'custom']

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json({ error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
  }

  const sp = req.nextUrl.searchParams
  const period = (sp.get('period') ?? 'last_month') as PanelPeriod
  const filters: PanelFilters = {
    period: VALID_PERIODS.includes(period) ? period : 'last_month',
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    branch_id: sp.get('branch_id') ?? undefined,
  }

  const invoices = await getPanelRecentInvoices(orgId, filters)
  return NextResponse.json({ invoices })
})
