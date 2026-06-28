import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getSite } from '@/modules/integrations/woocommerce/woo-sites.service'
import {
  cancelCatalogPublish,
  getCatalogPublishStatus,
  isCatalogPublishCancelledForSite,
  startCatalogPublish,
} from '@/modules/integrations/woocommerce/woo-catalog-publish.service'
import { drainCatalogPublishQueueForSite } from '@/modules/integrations/woocommerce/woo-sync-worker.service'
import { woocommercePublishSchema } from '@/modules/integrations/woocommerce/woocommerce.schema'

function handlePublishError(err: unknown): NextResponse | null {
  if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
    return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
  }
  if (err instanceof Error && err.message === 'SITE_NOT_FOUND') {
    return NextResponse.json({ error: 'Sitio no encontrado', code: 'SITE_NOT_FOUND' }, { status: 404 })
  }
  return null
}

export const GET = withPermission<{ id: string }>('settings:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    await getSite(id, ctxTenant.orgId)
    return NextResponse.json(await getCatalogPublishStatus(id, ctxTenant.orgId))
  } catch (err: unknown) {
    const handled = handlePublishError(err)
    if (handled) return handled
    throw err
  }
})

// start (default) | tick | cancel — single route avoids nested /publish/* 404s in dev.
export const POST = withPermission<{ id: string }>('settings:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = woocommercePublishSchema.parse(await req.json().catch(() => ({})))

  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)

    if (body.action === 'cancel') {
      return NextResponse.json({ ok: true, ...(await cancelCatalogPublish(id, ctxTenant.orgId)) })
    }

    if (body.action === 'tick') {
      if (!isCatalogPublishCancelledForSite(id)) {
        await drainCatalogPublishQueueForSite(id, 1)
      }
      return NextResponse.json({ ok: true, ...(await getCatalogPublishStatus(id, ctxTenant.orgId)) })
    }

    return NextResponse.json({ ok: true, ...(await startCatalogPublish(site)) })
  } catch (err: unknown) {
    const handled = handlePublishError(err)
    if (handled) return handled
    throw err
  }
})
