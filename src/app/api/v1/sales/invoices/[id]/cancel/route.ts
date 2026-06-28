import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext, tenancyErrorResponse } from '@/lib/tenancy'
import { cancelInvoice } from '@/modules/sales/invoices.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const invoice = await cancelInvoice(id, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_PAID_NOT_CANCELLABLE') return NextResponse.json({ error: 'No se puede anular una factura cobrada', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'INVOICE_ALREADY_CANCELLED') return NextResponse.json({ error: 'La factura ya está anulada', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
