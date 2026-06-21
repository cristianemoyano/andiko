import { NextResponse } from 'next/server'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { getCachedPanelData, panelCacheKey, PANEL_CACHE_TTL_MS } from '@/modules/panel/panel-cache'
import { getPanelRecentInvoices, parsePanelFilters } from '@/modules/panel/panel.service'
import { applyPanelBranchScope, withPanelAccess } from '@/modules/panel/panel-guard'

const CACHE_HEADERS = {
  'Cache-Control': `private, max-age=${PANEL_CACHE_TTL_MS / 1000}`,
}

export const GET = withPanelAccess(async (req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json({ error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
  }

  const filters = applyPanelBranchScope(session, parsePanelFilters(req.nextUrl.searchParams))
  const cacheKey = panelCacheKey(orgId, 'recent-invoices', filters)
  const invoices = await getCachedPanelData(cacheKey, () => getPanelRecentInvoices(orgId, filters))

  return NextResponse.json({ invoices }, { headers: CACHE_HEADERS })
})
