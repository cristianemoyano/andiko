import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { salesOrderUpdateSchema } from '@/modules/sales/sales-order.schema'
import { getOrder, updateOrder, deleteOrder } from '@/modules/sales/sales-orders.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const order = await getOrder(id, ctxTenant)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
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
    const ctxTenant = await makeTenantContext(session.user)
    const order = await updateOrder(id, parsed.data, ctxTenant, session.user.id!)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
    }
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
    const ctxTenant = await makeTenantContext(session.user)
    await deleteOrder(id, ctxTenant, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_DELETABLE') return NextResponse.json({ error: 'No se puede eliminar un pedido entregado', code: 'NOT_DELETABLE' }, { status: 409 })
    }
    throw err
  }
})
