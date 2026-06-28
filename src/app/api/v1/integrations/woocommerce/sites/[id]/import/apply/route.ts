import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { woocommerceImportApplySchema } from '@/modules/integrations/woocommerce/woocommerce.schema'
import { getSite } from '@/modules/integrations/woocommerce/woo-sites.service'
import { applyImport } from '@/modules/integrations/woocommerce/woo-import.service'

// Applies onboarding import: links/imports products, backfills orders, sets baseline.
export const POST = withPermission<{ id: string }>('settings:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = woocommerceImportApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)
    return NextResponse.json(await applyImport(site, parsed.data))
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
