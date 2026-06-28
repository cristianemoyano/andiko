import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { retryEmission } from '@/modules/afip/afip-contingency.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const doc = await retryEmission(id, tenantCtx)
    return NextResponse.json(doc)
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
