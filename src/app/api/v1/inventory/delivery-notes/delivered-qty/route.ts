import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
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
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const delivered = await getDeliveredQtyByOrderItem(orderId, orgId)
  return NextResponse.json({ delivered })
})
