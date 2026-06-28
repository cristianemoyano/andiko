import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext, tenancyErrorResponse } from '@/lib/tenancy'
import { issueInvoice } from '@/modules/sales/invoices.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const invoice = await issueInvoice(id, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_ALREADY_ISSUED') return NextResponse.json({ error: 'La factura ya fue emitida', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
