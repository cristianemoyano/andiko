import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext, tenancyErrorResponse } from '@/lib/tenancy'
import { invoiceUpdateSchema } from '@/modules/sales/invoice.schema'
import { getInvoice, updateInvoice, deleteInvoice } from '@/modules/sales/invoices.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const invoice = await getInvoice(id, tenantResult.ctx)
    return NextResponse.json(invoice)
  } catch (err) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = invoiceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const invoice = await updateInvoice(id, parsed.data, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_NOT_EDITABLE') return NextResponse.json({ error: 'Solo se pueden editar facturas en borrador', code: 'NOT_EDITABLE' }, { status: 409 })
      if (err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json({ error: 'La sucursal solo se puede cambiar en facturas en borrador.', code: 'BRANCH_NOT_CHANGEABLE' }, { status: 409 })
      }
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    await deleteInvoice(id, tenantResult.ctx, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_NOT_DELETABLE') return NextResponse.json({ error: 'Solo se pueden eliminar facturas en borrador', code: 'NOT_DELETABLE' }, { status: 409 })
    }
    throw err
  }
})
