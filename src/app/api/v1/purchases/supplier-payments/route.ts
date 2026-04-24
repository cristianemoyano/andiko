import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { supplierPaymentSchema, supplierPaymentQuerySchema } from '@/modules/purchases/supplier-payment.schema'
import { listSupplierPayments, createSupplierPayment } from '@/modules/purchases/supplier-payments.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = supplierPaymentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  const result = await listSupplierPayments(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('purchases:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = supplierPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const payment = await createSupplierPayment(parsed.data, orgId, session.user.id!)
    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'SUPPLIER_INVOICE_NOT_FOUND')  return NextResponse.json({ error: 'Factura de proveedor no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'SUPPLIER_INVOICE_CANCELLED')  return NextResponse.json({ error: 'No se puede pagar una factura cancelada', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'SUPPLIER_INVOICE_ALREADY_PAID') return NextResponse.json({ error: 'La factura ya está pagada', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'SUPPLIER_INVOICE_NOT_RECEIVED') return NextResponse.json({ error: 'La factura debe estar recibida para registrar un pago', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'SUPPLIER_PAYMENT_BRANCH_REQUIRED') return NextResponse.json({ error: 'Se requiere sucursal para numerar el pago', code: 'SUPPLIER_PAYMENT_BRANCH_REQUIRED' }, { status: 422 })
      if (err.message === 'BRANCH_NOT_FOUND') return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
