import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { carrierAccountUpdateSchema } from '@/modules/logistics/carrier-account.schema'
import { getCarrierAccount, updateCarrierAccount, deleteCarrierAccount } from '@/modules/logistics/carrier-accounts.service'

export const GET = withTenantPermission<{ id: string }>('sales:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const account = await getCarrierAccount(id, ctx)
    return NextResponse.json(account)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('sales:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = carrierAccountUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const account = await updateCarrierAccount(id, parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(account)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const DELETE = withTenantPermission<{ id: string }>('sales:delete', async (_req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    await deleteCarrierAccount(id, ctx, resolveActorId(session))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
