import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { convertOrderToInvoice } from '@/modules/sales/sales-orders.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const invoice = await convertOrderToInvoice(id, session.user.orgId!, session.user.id!)
    return NextResponse.json(invoice, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')        return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_CONVERTIBLE')  return NextResponse.json({ error: 'El pedido debe estar confirmado o en proceso para generar una factura', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
