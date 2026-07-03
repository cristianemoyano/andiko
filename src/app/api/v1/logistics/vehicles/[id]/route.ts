import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { vehicleUpdateSchema } from '@/modules/logistics/vehicle.schema'
import { getVehicle, updateVehicle, deleteVehicle } from '@/modules/logistics/vehicles.service'

export const GET = withTenantPermission<{ id: string }>('logistics:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const data = await getVehicle(id, ctx)
    return NextResponse.json({ data })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const body = vehicleUpdateSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await updateVehicle(id, body, ctx, actorId)
    return NextResponse.json({ data })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})

export const DELETE = withTenantPermission<{ id: string }>('logistics:delete', async (_req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const actorId = resolveActorId(session)
    await deleteVehicle(id, ctx, actorId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
