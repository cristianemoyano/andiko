import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { supplierPaymentUpdateSchema } from '@/modules/purchases/supplier-payment.schema'
import { getSupplierPayment, updateSupplierPayment, deleteSupplierPayment } from '@/modules/purchases/supplier-payments.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const payment = await getSupplierPayment(id, orgId)
    return NextResponse.json(payment)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SUPPLIER_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago a proveedor no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = supplierPaymentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const payment = await updateSupplierPayment(id, parsed.data, orgId, session.user.id!)
    return NextResponse.json(payment)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SUPPLIER_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago a proveedor no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission('purchases:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    await deleteSupplierPayment(id, orgId, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SUPPLIER_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago a proveedor no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
