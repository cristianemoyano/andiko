import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { requestCAEForInvoice } from '@/modules/afip/afip-emission.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const invoice = await requestCAEForInvoice(id, tenantCtx)
    return NextResponse.json(invoice)
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
