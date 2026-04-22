import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { convertQuoteToOrder } from '@/modules/sales/sales-quotes.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const order = await convertQuoteToOrder(id, session.user.orgId!, session.user.id!)
    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'QUOTE_NOT_FOUND')    return NextResponse.json({ error: 'Presupuesto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'QUOTE_NOT_ACCEPTED') return NextResponse.json({ error: 'El presupuesto debe estar aceptado para convertirse en pedido', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
