import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { salesOrderUpdateSchema } from '@/modules/sales/sales-order.schema'
import { getOrder, updateOrder, deleteOrder } from '@/modules/sales/sales-orders.service'
import { saleLineItemValidationResponse, saleLineStockValidationResponse } from '@/lib/sales-route-errors'
import { branchWarehouseResolutionResponse } from '@/lib/inventory-route-errors'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
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
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const submittedKeys = Object.keys(body)
    const order = await updateOrder(id, parsed.data, ctxTenant, resolveActorId(session), submittedKeys)
    return NextResponse.json(order)
  } catch (err: unknown) {
    const lineErr = saleLineItemValidationResponse(err)
    if (lineErr) return lineErr
    const stockErr = saleLineStockValidationResponse(err)
    if (stockErr) return stockErr
    const branchWarehouseErr = branchWarehouseResolutionResponse(err)
    if (branchWarehouseErr) return branchWarehouseErr
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
    }
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_EDITABLE') {
        return NextResponse.json(
          { error: 'El pedido no admite esta modificación. Si solo querés asignar cliente, usá «Asignar cliente».', code: 'NOT_EDITABLE' },
          { status: 409 },
        )
      }
      if (err.message === 'ORDER_BRANCH_NOT_CHANGEABLE' || err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json(
          { error: 'La sucursal solo se puede cambiar en pedidos en borrador.', code: 'BRANCH_NOT_CHANGEABLE' },
          { status: 409 },
        )
      }
      if (err.message === 'INSUFFICIENT_STOCK') {
        return NextResponse.json(
          { error: 'Stock insuficiente en el depósito de la sucursal. Transferí mercadería antes de confirmar el pedido.', code: 'INSUFFICIENT_STOCK' },
          { status: 422 },
        )
      }
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    await deleteOrder(id, ctxTenant, resolveActorId(session))
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
