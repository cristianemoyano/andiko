import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { supplierInvoiceUpdateSchema } from '@/modules/purchases/supplier-invoice.schema'
import { getSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice } from '@/modules/purchases/supplier-invoices.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('purchases:read', async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const invoice = await getSupplierInvoice(id)
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SUPPLIER_INVOICE_NOT_FOUND') {
      return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = supplierInvoiceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const invoice = await updateSupplierInvoice(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'SUPPLIER_INVOICE_NOT_FOUND') return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'SUPPLIER_INVOICE_LOCKED')    return NextResponse.json({ error: 'La factura está bloqueada y no puede editarse', code: 'SUPPLIER_INVOICE_LOCKED' }, { status: 409 })
      if (err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json({ error: 'La sucursal solo se puede cambiar en facturas de proveedor en borrador.', code: 'BRANCH_NOT_CHANGEABLE' }, { status: 409 })
      }
    }
    throw err
  }
})

export const DELETE = withPermission('purchases:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    await deleteSupplierInvoice(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'SUPPLIER_INVOICE_NOT_FOUND') return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'SUPPLIER_INVOICE_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar facturas en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
