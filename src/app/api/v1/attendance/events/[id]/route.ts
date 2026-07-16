import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { attendanceEventUpdateSchema } from '@/modules/attendance/attendance-event.schema'
import { getAttendanceEvent, updateAttendanceEvent, deleteAttendanceEvent } from '@/modules/attendance/attendance-events.service'

export const GET = withTenantPermission<{ id: string }>('attendance:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const data = await getAttendanceEvent(id, ctx)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('attendance:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const body = attendanceEventUpdateSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await updateAttendanceEvent(id, body, ctx, actorId)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const DELETE = withTenantPermission<{ id: string }>('attendance:delete', async (_req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const actorId = resolveActorId(session)
    await deleteAttendanceEvent(id, ctx, actorId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
