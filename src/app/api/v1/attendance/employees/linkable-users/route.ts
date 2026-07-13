import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { listLinkableUsers } from '@/modules/attendance/employees.service'

export const GET = withTenantPermission('employees:read', async (_req, _routeCtx, _session, ctx) => {
  const data = await listLinkableUsers(ctx)
  return NextResponse.json({ data })
})
