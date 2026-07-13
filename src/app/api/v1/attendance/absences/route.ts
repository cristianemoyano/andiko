import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { absenceSchema } from '@/modules/attendance/attendance-event.schema'
import { createAbsence } from '@/modules/attendance/attendance-events.service'

export const POST = withTenantPermission('attendance:write', async (req, _routeCtx, session, ctx) => {
  try {
    const body = absenceSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await createAbsence(body, ctx, actorId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
