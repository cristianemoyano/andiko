import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { purchaseReceiptSchema, purchaseReceiptQuerySchema } from '@/modules/purchases/purchase-receipt.schema'
import { listPurchaseReceipts, createPurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseReceiptQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const result = await listPurchaseReceipts(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('purchases:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = purchaseReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const receipt = await createPurchaseReceipt(parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(receipt, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND')    return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
          }
    throw err
  }
})
