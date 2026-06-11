import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { invoiceUpdateSchema } from '@/modules/sales/invoice.schema'
import { getInvoice, updateInvoice, deleteInvoice } from '@/modules/sales/invoices.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const invoice = await getInvoice(id, tenantCtx)
    return NextResponse.json(invoice)
  } catch {
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
  try {
    const invoice = await updateInvoice(id, parsed.data, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_NOT_EDITABLE') return NextResponse.json({ error: 'Solo se pueden editar facturas en borrador', code: 'NOT_EDITABLE' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteInvoice(id, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_NOT_DELETABLE') return NextResponse.json({ error: 'Solo se pueden eliminar facturas en borrador', code: 'NOT_DELETABLE' }, { status: 409 })
    }
    throw err
  }
})
