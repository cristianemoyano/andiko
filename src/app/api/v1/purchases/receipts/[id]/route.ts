import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { purchaseReceiptUpdateSchema } from '@/modules/purchases/purchase-receipt.schema'
import { getPurchaseReceipt, updatePurchaseReceipt, deletePurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'

export const GET = withPermission('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  try {
    const receipt = await getPurchaseReceipt(id, orgScope.orgId)
    return NextResponse.json(receipt)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PURCHASE_RECEIPT_NOT_FOUND') {
      return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = purchaseReceiptUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const receipt = await updatePurchaseReceipt(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(receipt)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RECEIPT_NOT_FOUND') return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_RECEIPT_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden editar recepciones en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json({ error: 'La sucursal solo se puede cambiar en recepciones en borrador.', code: 'BRANCH_NOT_CHANGEABLE' }, { status: 409 })
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
    await deletePurchaseReceipt(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RECEIPT_NOT_FOUND') return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_RECEIPT_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar recepciones en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
