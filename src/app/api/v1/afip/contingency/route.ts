import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { paginationSchema } from '@/lib/pagination'
import { listPendingEmissions, syncPendingEmissions } from '@/modules/afip/afip-contingency.service'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = paginationSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctx = await makeTenantContext(session.user)
  const result = await listPendingEmissions(ctx, parsed.data.page, parsed.data.limit)
  return NextResponse.json(result)
})

/** Re-attempts every queued emission for the org (contingency sync). */
export const POST = withPermission('sales:write', async (_req, _ctx, session) => {
  const ctx = await makeTenantContext(session.user)
  const result = await syncPendingEmissions(ctx)
  return NextResponse.json({ processed: result.length, results: result })
})
