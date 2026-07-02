import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { cancelShipment } from '@/modules/logistics/shipments.service'

const cancelBodySchema = z.object({ reason: z.string().max(255).nullable().optional() })

export const POST = withTenantPermission<{ id: string }>('logistics:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  let body: unknown = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = cancelBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const shipment = await cancelShipment(id, ctx, resolveActorId(session), parsed.data.reason ?? undefined)
    return NextResponse.json(shipment)
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
