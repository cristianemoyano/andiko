import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { shipmentEventInputSchema } from '@/modules/logistics/shipment.schema'
import { recordShipmentEvent } from '@/modules/logistics/shipments.service'

export const POST = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = shipmentEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const shipment = await recordShipmentEvent(id, parsed.data, ctx, resolveActorId(session), 'manual')
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
