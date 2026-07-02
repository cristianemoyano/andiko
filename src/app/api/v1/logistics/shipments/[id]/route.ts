import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { shipmentAssignDriverSchema } from '@/modules/logistics/shipment.schema'
import { getShipment, assignShipmentDriver } from '@/modules/logistics/shipments.service'

export const GET = withTenantPermission<{ id: string }>('sales:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const shipment = await getShipment(id, ctx)
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('sales:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = shipmentAssignDriverSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const shipment = await assignShipmentDriver(id, parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
