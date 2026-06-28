import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { confirmPurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'

export const POST = withPermission('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    const receipt = await confirmPurchaseReceipt(id, orgId, resolveActorId(session))
    return NextResponse.json(receipt)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RECEIPT_NOT_FOUND')    return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_RECEIPT_NOT_DRAFT')    return NextResponse.json({ error: 'La recepción no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'PURCHASE_RECEIPT_NO_WAREHOUSE') return NextResponse.json({ error: 'La recepción debe tener un depósito asignado', code: 'PURCHASE_RECEIPT_NO_WAREHOUSE' }, { status: 422 })
      if (err.message === 'INSUFFICIENT_STOCK')            return NextResponse.json({ error: 'Stock insuficiente para uno de los productos', code: 'INSUFFICIENT_STOCK' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
