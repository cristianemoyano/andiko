import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { eligibleShipmentQuerySchema } from '@/modules/logistics/delivery-run.schema'
import { listEligibleRunShipments } from '@/modules/logistics/delivery-runs.service'

export const GET = withTenantPermission('logistics:read', async (req, _routeCtx, _session, ctx) => {
  const parsed = eligibleShipmentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await listEligibleRunShipments(parsed.data, ctx)
    return NextResponse.json(result)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
