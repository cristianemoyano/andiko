import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { purchaseReceiptStatusCountsQuerySchema } from '@/modules/purchases/purchase-receipt.schema'
import { getPurchaseReceiptStatusCounts } from '@/modules/purchases/purchase-receipts.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseReceiptStatusCountsQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const data = await getPurchaseReceiptStatusCounts(parsed.data, orgScope.orgId)
  return NextResponse.json({ data })
})
