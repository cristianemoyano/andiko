import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { getSalesReturn } from '@/modules/sales/sales-returns.service'
import { requestCAEForCreditNote } from '@/modules/afip/afip-emission.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const salesReturn = await getSalesReturn(id, tenantCtx)
    if (!salesReturn.credit_note_id) {
      return NextResponse.json({ error: 'La devolución no tiene nota de crédito', code: 'CREDIT_NOTE_MISSING' }, { status: 422 })
    }
    const note = await requestCAEForCreditNote(salesReturn.credit_note_id, tenantCtx)
    return NextResponse.json(note)
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
