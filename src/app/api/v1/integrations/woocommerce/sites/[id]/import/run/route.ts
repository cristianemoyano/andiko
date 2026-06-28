import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getSite } from '@/modules/integrations/woocommerce/woo-sites.service'
import {
  cancelImportRun,
  getImportRunStatus,
  isImportCancelledForSite,
  startImportRun,
} from '@/modules/integrations/woocommerce/woo-import-run.service'
import { drainImportQueueForSite } from '@/modules/integrations/woocommerce/woo-sync-worker.service'
import { defaultImportTickBatch } from '@/modules/integrations/woocommerce/woo-import.constants'
import { woocommerceImportRunSchema } from '@/modules/integrations/woocommerce/woocommerce.schema'

function handleImportRunError(err: unknown): NextResponse | null {
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
    return NextResponse.json(await getImportRunStatus(id, ctxTenant.orgId))
  } catch (err: unknown) {
    const handled = handleImportRunError(err)
    if (handled) return handled
    throw err
  }
})

export const POST = withPermission<{ id: string }>('settings:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = woocommerceImportRunSchema.parse(await req.json().catch(() => ({})))

  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)

    if (body.action === 'cancel') {
      return NextResponse.json({ ok: true, ...(await cancelImportRun(id, ctxTenant.orgId)) })
    }

    if (body.action === 'tick') {
      if (!isImportCancelledForSite(id)) {
        const status = await getImportRunStatus(id, ctxTenant.orgId)
        const batch = body.limit ?? defaultImportTickBatch(status.scope)
        await drainImportQueueForSite(id, batch)
      }
      return NextResponse.json({ ok: true, ...(await getImportRunStatus(id, ctxTenant.orgId)) })
    }

    if (!body.scope) {
      return NextResponse.json({ error: 'scope is required to start an import run', code: 'VALIDATION_ERROR' }, { status: 422 })
    }

    return NextResponse.json({
      ok: true,
      ...(await startImportRun(site, body.scope, {
        import_unmatched_products: body.import_unmatched_products ?? true,
        import_orders: body.scope === 'orders',
        orders_since: body.orders_since ?? null,
        open_orders_only: body.open_orders_only ?? true,
        stock_baseline: body.stock_baseline ?? 'none',
      })),
    })
  } catch (err: unknown) {
    const handled = handleImportRunError(err)
    if (handled) return handled
    throw err
  }
})
