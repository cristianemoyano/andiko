import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { purchaseReturnStatusCountsQuerySchema } from '@/modules/purchases/purchase-return.schema'
import { getPurchaseReturnStatusCounts } from '@/modules/purchases/purchase-returns.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseReturnStatusCountsQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const ctxResult = await resolveTenantContext(session.user)
  if ('error' in ctxResult) return ctxResult.error
  const data = await getPurchaseReturnStatusCounts(parsed.data, ctxResult.ctx)
  return NextResponse.json({ data })
})
