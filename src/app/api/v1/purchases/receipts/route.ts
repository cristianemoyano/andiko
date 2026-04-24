import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { purchaseReceiptSchema, purchaseReceiptQuerySchema } from '@/modules/purchases/purchase-receipt.schema'
import { listPurchaseReceipts, createPurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseReceiptQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  const result = await listPurchaseReceipts(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('purchases:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = purchaseReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const receipt = await createPurchaseReceipt(parsed.data, orgId, session.user.id!)
    return NextResponse.json(receipt, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND')    return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })
    }
    throw err
  }
})
