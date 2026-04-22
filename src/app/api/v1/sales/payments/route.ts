import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { paymentSchema, paymentQuerySchema } from '@/modules/sales/payment.schema'
import { listPayments, createPayment } from '@/modules/sales/payments.service'

export const GET = withPermission('sales:read', async (req) => {
  const parsed = paymentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listPayments(parsed.data)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const payment = await createPayment(parsed.data, session.user.orgId!, session.user.id!)
    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INVOICE_NOT_FOUND')  return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'INVOICE_CANCELLED')  return NextResponse.json({ error: 'No se puede cobrar una factura anulada', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'INVOICE_NOT_ISSUED') return NextResponse.json({ error: 'La factura debe estar emitida para registrar un cobro', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'INVOICE_ALREADY_PAID') return NextResponse.json({ error: 'La factura ya está cobrada', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
