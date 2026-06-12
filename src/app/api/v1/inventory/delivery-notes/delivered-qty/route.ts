import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { getDeliveredQtyByOrderItem } from '@/modules/inventory/delivery-notes.service'

/**
 * Returns already-delivered quantity per order_item_id for a sales order,
 * counting non-annulled delivery notes. Used to pre-fill pending quantities
 * when creating a delivery note from an order.
 */
export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const orderId = req.nextUrl.searchParams.get('order_id')
  if (!orderId) {
    return NextResponse.json({ error: 'order_id requerido', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json({ error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
  }

  const delivered = await getDeliveredQtyByOrderItem(orderId, orgId)
  return NextResponse.json({ delivered })
})
