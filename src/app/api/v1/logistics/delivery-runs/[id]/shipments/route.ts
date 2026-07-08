import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { deliveryRunAddShipmentsSchema } from '@/modules/logistics/delivery-run.schema'
import { addShipmentsToRun } from '@/modules/logistics/delivery-runs.service'

export const POST = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = deliveryRunAddShipmentsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const run = await addShipmentsToRun(id, parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(run)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
