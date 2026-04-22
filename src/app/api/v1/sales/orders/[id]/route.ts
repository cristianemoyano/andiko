import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { salesOrderUpdateSchema } from '@/modules/sales/sales-order.schema'
import { getOrder, updateOrder, deleteOrder } from '@/modules/sales/sales-orders.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const order = await getOrder(id)
    return NextResponse.json(order)
  } catch {
    return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = salesOrderUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const order = await updateOrder(id, parsed.data, session.user.id!)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_EDITABLE') return NextResponse.json({ error: 'El pedido no es editable', code: 'NOT_EDITABLE' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteOrder(id, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_DELETABLE') return NextResponse.json({ error: 'No se puede eliminar un pedido entregado', code: 'NOT_DELETABLE' }, { status: 409 })
    }
    throw err
  }
})
