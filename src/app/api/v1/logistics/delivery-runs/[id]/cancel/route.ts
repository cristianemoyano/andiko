import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { deliveryRunCancelSchema } from '@/modules/logistics/delivery-run.schema'
import { cancelDeliveryRun } from '@/modules/logistics/delivery-runs.service'

export const POST = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = deliveryRunCancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const run = await cancelDeliveryRun(id, ctx, resolveActorId(session), parsed.data.reason)
    return NextResponse.json(run)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
