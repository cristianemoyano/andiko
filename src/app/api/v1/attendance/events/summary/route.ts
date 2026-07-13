import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { dailyTotalsQuerySchema } from '@/modules/attendance/attendance-event.schema'
import { getDailyTotals } from '@/modules/attendance/attendance-events.service'

export const GET = withTenantPermission('attendance:read', async (req, _routeCtx, _session, ctx) => {
  try {
    const query = dailyTotalsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const data = await getDailyTotals(query, ctx)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
