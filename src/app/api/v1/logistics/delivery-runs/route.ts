import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { deliveryRunQuerySchema, deliveryRunSchema } from '@/modules/logistics/delivery-run.schema'
import { createDeliveryRun, listDeliveryRuns } from '@/modules/logistics/delivery-runs.service'

export const GET = withTenantPermission('logistics:read', async (req, _routeCtx, _session, ctx) => {
  const parsed = deliveryRunQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listDeliveryRuns(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withTenantPermission('logistics:write', async (req, _routeCtx, session, ctx) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = deliveryRunSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const run = await createDeliveryRun(parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(run, { status: 201 })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
