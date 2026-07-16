import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { getMyStatus } from '@/modules/attendance/attendance-events.service'

export const GET = withTenantPermission('attendance:read', async (_req, _routeCtx, _session, ctx) => {
  try {
    const data = await getMyStatus(ctx)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
