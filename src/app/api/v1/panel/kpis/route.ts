import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { getCachedPanelData, panelCacheKey, PANEL_CACHE_TTL_MS } from '@/modules/panel/panel-cache'
import { getPanelKpisPayload, parsePanelFilters } from '@/modules/panel/panel.service'

const CACHE_HEADERS = {
  'Cache-Control': `private, max-age=${PANEL_CACHE_TTL_MS / 1000}`,
}

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json({ error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
  }

  const filters = parsePanelFilters(req.nextUrl.searchParams)
  const cacheKey = panelCacheKey(orgId, 'kpis', filters)
  const payload = await getCachedPanelData(cacheKey, () => getPanelKpisPayload(orgId, filters))

  return NextResponse.json(payload, { headers: CACHE_HEADERS })
})
