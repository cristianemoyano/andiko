import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { purchaseOrderStatusCountsQuerySchema } from '@/modules/purchases/purchase-order.schema'
import { getPurchaseOrderStatusCounts } from '@/modules/purchases/purchase-orders.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseOrderStatusCountsQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const tenantCtxResult = await resolveTenantContext(session.user)
  if ('error' in tenantCtxResult) return tenantCtxResult.error
  const data = await getPurchaseOrderStatusCounts(parsed.data, tenantCtxResult.ctx)
  return NextResponse.json({ data })
})
