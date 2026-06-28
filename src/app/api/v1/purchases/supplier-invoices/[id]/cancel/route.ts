import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { cancelSupplierInvoice } from '@/modules/purchases/supplier-invoices.service'

export const POST = withPermission('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    const invoice = await cancelSupplierInvoice(id, orgId, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'SUPPLIER_INVOICE_NOT_FOUND')       return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'SUPPLIER_INVOICE_ALREADY_PAID')    return NextResponse.json({ error: 'La factura ya está pagada', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'SUPPLIER_INVOICE_ALREADY_CANCELLED') return NextResponse.json({ error: 'La factura ya está cancelada', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
