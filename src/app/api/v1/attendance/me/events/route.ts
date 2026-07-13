import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { paginationSchema } from '@/lib/pagination'
import { listMyEvents } from '@/modules/attendance/attendance-events.service'

export const GET = withTenantPermission('attendance:read', async (req, _routeCtx, _session, ctx) => {
  try {
    const query = paginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const result = await listMyEvents(query, ctx)
    return NextResponse.json(result)
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
