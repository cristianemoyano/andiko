import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getSite } from '@/modules/integrations/woocommerce/woo-sites.service'
import { previewOrderImport } from '@/modules/integrations/woocommerce/woo-import.service'
import { woocommerceOrderImportPreviewSchema } from '@/modules/integrations/woocommerce/woocommerce.schema'

// Dry-run report for historical order backfill. No writes.
export const POST = withPermission<{ id: string }>('settings:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = woocommerceOrderImportPreviewSchema.parse(await req.json().catch(() => ({})))
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)
    return NextResponse.json(await previewOrderImport(site, body))
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
