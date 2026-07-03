import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { convertOrderToInvoice } from '@/modules/sales/sales-orders.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const invoice = await convertOrderToInvoice(id, ctxTenant, resolveActorId(session))
    return NextResponse.json(invoice, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      if (err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
        return NextResponse.json({ error: 'No tenés acceso a esa sucursal.', code: err.code }, { status: 403 })
      }
    }
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')     return NextResponse.json({ error: 'Pedido no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_INVOICEABLE') {
        return NextResponse.json(
          { error: 'El pedido debe estar confirmado para generar una factura', code: 'ORDER_NOT_INVOICEABLE' },
          { status: 409 },
        )
      }
      if (err.message === 'ORDER_NOT_DELIVERED') {
        return NextResponse.json(
          { error: 'El pedido debe estar confirmado para generar una factura', code: 'ORDER_NOT_INVOICEABLE' },
          { status: 409 },
        )
      }
      if (err.message === 'ORDER_ALREADY_INVOICED') {
        const invoiceId = (err as Error & { invoiceId?: string }).invoiceId
        return NextResponse.json(
          {
            error: 'Este pedido ya tiene una factura.',
            code: 'ORDER_ALREADY_INVOICED',
            ...(invoiceId ? { details: { invoice_id: invoiceId } } : {}),
          },
          { status: 409 },
        )
      }
      if (err.message === 'ORDER_BRANCH_REQUIRED') {
        return NextResponse.json(
          { error: 'El pedido no tiene sucursal asignada; no se puede generar la factura.', code: 'ORDER_BRANCH_REQUIRED' },
          { status: 422 },
        )
      }
      if (err.message === 'ORDER_CONTACT_REQUIRED') {
        return NextResponse.json(
          { error: 'El pedido debe tener un cliente asignado para generar la factura.', code: 'ORDER_CONTACT_REQUIRED' },
          { status: 422 },
        )
      }
      if (err.message === 'BRANCH_NOT_FOUND') {
        return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      }
    }
    throw err
  }
})
