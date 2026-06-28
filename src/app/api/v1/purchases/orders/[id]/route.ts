import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { purchaseOrderUpdateSchema } from '@/modules/purchases/purchase-order.schema'
import { getPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from '@/modules/purchases/purchase-orders.service'

export const GET = withPermission('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  try {
    const order = await getPurchaseOrder(id, orgScope.orgId)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PURCHASE_ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Orden de compra no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = purchaseOrderUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    const order = await updatePurchaseOrder(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_ORDER_NOT_FOUND') return NextResponse.json({ error: 'Orden de compra no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_ORDER_LOCKED')    return NextResponse.json({ error: 'La orden está bloqueada y no puede editarse', code: 'PURCHASE_ORDER_LOCKED' }, { status: 409 })
      if (err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json({ error: 'La sucursal solo se puede cambiar en órdenes de compra en borrador.', code: 'BRANCH_NOT_CHANGEABLE' }, { status: 409 })
      }
    }
    throw err
  }
})

export const DELETE = withPermission('purchases:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    await deletePurchaseOrder(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_ORDER_NOT_FOUND') return NextResponse.json({ error: 'Orden de compra no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_ORDER_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar órdenes en borrador', code: 'PURCHASE_ORDER_NOT_DRAFT' }, { status: 409 })
    }
    throw err
  }
})
