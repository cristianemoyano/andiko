import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { receiveSupplierInvoice } from '@/modules/purchases/supplier-invoices.service'

export const POST = withPermission('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json(
      { error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' },
      { status: 422 },
    )
  }

  try {
    const invoice = await receiveSupplierInvoice(id, orgId, session.user.id!)
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'SUPPLIER_INVOICE_NOT_FOUND') return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'SUPPLIER_INVOICE_NOT_DRAFT') return NextResponse.json({ error: 'La factura no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
