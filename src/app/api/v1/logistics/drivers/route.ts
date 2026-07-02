import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { listDrivers } from '@/modules/logistics/shipments.service'

export const GET = withTenantPermission('sales:read', async (_req, _ctx, _session, ctx) => {
  const data = await listDrivers(ctx)
  return NextResponse.json({ data })
})
