import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { attendanceEventQuerySchema, attendanceEventSchema } from '@/modules/attendance/attendance-event.schema'
import { listAttendanceEvents, createAttendanceEvent } from '@/modules/attendance/attendance-events.service'

export const GET = withTenantPermission('attendance:read', async (req, _routeCtx, _session, ctx) => {
  try {
    const query = attendanceEventQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const result = await listAttendanceEvents(query, ctx)
    return NextResponse.json(result)
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const POST = withTenantPermission('attendance:write', async (req, _routeCtx, session, ctx) => {
  try {
    const body = attendanceEventSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await createAttendanceEvent(body, ctx, actorId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
