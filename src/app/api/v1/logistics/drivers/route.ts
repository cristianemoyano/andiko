import { NextResponse } from 'next/server'
import { withTenantAnyPermission } from '@/lib/api-handler'
import { listDrivers } from '@/modules/logistics/shipments.service'

export const GET = withTenantAnyPermission(['logistics:read', 'sales:write'], async (_req, _ctx, _session, ctx) => {
  const data = await listDrivers(ctx)
  return NextResponse.json({ data })
})
