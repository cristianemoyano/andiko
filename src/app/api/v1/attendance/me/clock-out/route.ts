import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { clockOut } from '@/modules/attendance/attendance-events.service'

export const POST = withTenantPermission('attendance:write', async (_req, _routeCtx, session, ctx) => {
  try {
    const actorId = resolveActorId(session)
    const data = await clockOut(ctx, actorId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
