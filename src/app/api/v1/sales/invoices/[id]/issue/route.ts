import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { issueInvoice } from '@/modules/sales/invoices.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const invoice = await issueInvoice(id, session.user.id!)
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_ALREADY_ISSUED') return NextResponse.json({ error: 'La factura ya fue emitida', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
