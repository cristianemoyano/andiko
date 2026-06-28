import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getSite } from '@/modules/integrations/woocommerce/woo-sites.service'
import { publishAllVariantsForSite } from '@/modules/integrations/woocommerce/woo-resync.service'

// Publishes/refreshes the full catalog for a site (manual resync — ERP → Woo).
export const POST = withPermission<{ id: string }>('settings:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)
    const result = await publishAllVariantsForSite(site)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'SITE_NOT_FOUND') {
      return NextResponse.json({ error: 'Sitio no encontrado', code: 'SITE_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
