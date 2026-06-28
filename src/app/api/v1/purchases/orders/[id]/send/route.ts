import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { sendPurchaseOrder } from '@/modules/purchases/purchase-orders.service'

export const POST = withPermission('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    const order = await sendPurchaseOrder(id, orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_ORDER_NOT_FOUND') return NextResponse.json({ error: 'Orden de compra no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_ORDER_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden enviar órdenes en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
