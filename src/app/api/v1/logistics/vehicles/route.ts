import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { vehicleQuerySchema, vehicleSchema } from '@/modules/logistics/vehicle.schema'
import { listVehicles, createVehicle } from '@/modules/logistics/vehicles.service'

export const GET = withTenantPermission('logistics:read', async (req, _ctx, _session, ctx) => {
  const query = vehicleQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
  const result = await listVehicles(query, ctx)
  return NextResponse.json(result)
})

export const POST = withTenantPermission('logistics:write', async (req, _ctx, session, ctx) => {
  try {
    const body = vehicleSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await createVehicle(body, ctx, actorId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
