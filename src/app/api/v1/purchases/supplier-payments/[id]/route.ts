import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { supplierPaymentUpdateSchema } from '@/modules/purchases/supplier-payment.schema'
import { getSupplierPayment, updateSupplierPayment, deleteSupplierPayment } from '@/modules/purchases/supplier-payments.service'

export const GET = withPermission('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
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
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const payment = await updateSupplierPayment(id, parsed.data, orgId, resolveActorId(session))
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
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    await deleteSupplierPayment(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SUPPLIER_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago a proveedor no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
