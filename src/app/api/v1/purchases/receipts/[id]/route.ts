import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { purchaseReceiptUpdateSchema } from '@/modules/purchases/purchase-receipt.schema'
import { getPurchaseReceipt, updatePurchaseReceipt, deletePurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('purchases:read', async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const receipt = await getPurchaseReceipt(id)
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
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const receipt = await updatePurchaseReceipt(id, parsed.data, orgId, session.user.id!)
    return NextResponse.json(receipt)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RECEIPT_NOT_FOUND') return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_RECEIPT_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden editar recepciones en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission('purchases:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    await deletePurchaseReceipt(id, orgId, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RECEIPT_NOT_FOUND') return NextResponse.json({ error: 'Recepción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PURCHASE_RECEIPT_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar recepciones en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
