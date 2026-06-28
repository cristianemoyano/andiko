import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { woocommerceSiteUpdateSchema } from '@/modules/integrations/woocommerce/woocommerce.schema'
import { getSite, updateSite, deleteSite, toPublicSite } from '@/modules/integrations/woocommerce/woo-sites.service'

function mapError(err: unknown): NextResponse | null {
  if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
    return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
  }
  if (err instanceof Error && err.message === 'SITE_NOT_FOUND') {
    return NextResponse.json({ error: 'Sitio no encontrado', code: 'SITE_NOT_FOUND' }, { status: 404 })
  }
  if (err instanceof Error && err.message === 'BRANCH_NOT_FOUND') {
    return NextResponse.json({ error: 'Sucursal no encontrada', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
  }
  return null
}

export const GET = withPermission<{ id: string }>('settings:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const site = await getSite(id, ctxTenant.orgId)
    return NextResponse.json(toPublicSite(site))
  } catch (err: unknown) {
    return mapError(err) ?? Promise.reject(err)
  }
})

export const PATCH = withPermission<{ id: string }>('settings:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = woocommerceSiteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    return NextResponse.json(await updateSite(id, parsed.data, ctxTenant, resolveActorId(session)))
  } catch (err: unknown) {
    return mapError(err) ?? Promise.reject(err)
  }
})

export const DELETE = withPermission<{ id: string }>('settings:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    await deleteSite(id, ctxTenant, resolveActorId(session))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return mapError(err) ?? Promise.reject(err)
  }
})
