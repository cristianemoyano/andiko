import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { createDeliveryNoteForShipment } from '@/modules/inventory/delivery-notes.service'

export const POST = withTenantPermission<{ id: string }>('logistics:write', async (_req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const note = await createDeliveryNoteForShipment(id, ctx.orgId, resolveActorId(session))
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
