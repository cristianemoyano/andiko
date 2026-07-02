import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { shipmentUpdateSchema } from '@/modules/logistics/shipment.schema'
import { getShipment, updateShipment } from '@/modules/logistics/shipments.service'

export const GET = withTenantPermission<{ id: string }>('logistics:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const shipment = await getShipment(id, ctx)
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = shipmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const shipment = await updateShipment(id, parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
