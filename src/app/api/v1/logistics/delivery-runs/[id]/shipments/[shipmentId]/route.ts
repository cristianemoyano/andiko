import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { removeShipmentFromRun } from '@/modules/logistics/delivery-runs.service'

export const DELETE = withTenantPermission<{ id: string; shipmentId: string }>('logistics:write', async (_req, routeCtx, session, ctx) => {
  const { id, shipmentId } = await routeCtx.params
  try {
    const run = await removeShipmentFromRun(id, shipmentId, ctx, resolveActorId(session))
    return NextResponse.json(run)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
