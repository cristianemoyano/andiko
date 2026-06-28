import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { resolveTenantContext } from '@/lib/tenancy'
import { purchaseOrderSchema, purchaseOrderQuerySchema } from '@/modules/purchases/purchase-order.schema'
import { listPurchaseOrders, createPurchaseOrder } from '@/modules/purchases/purchase-orders.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseOrderQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const tenantCtxResult = await resolveTenantContext(session.user)
  if ('error' in tenantCtxResult) return tenantCtxResult.error
  const result = await listPurchaseOrders(parsed.data, tenantCtxResult.ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('purchases:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = purchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const order = await createPurchaseOrder(parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND')    return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
          }
    throw err
  }
})
