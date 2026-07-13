import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { expensePaymentSchema, expensePaymentQuerySchema } from '@/modules/expenses/expense-payment.schema'
import { listExpensePayments, registerExpensePayment } from '@/modules/expenses/expense-payments.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = expensePaymentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const result = await listExpensePayments(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('expenses:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = expensePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const payment = await registerExpensePayment(parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND')             return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'EXPENSE_CANCELLED')             return NextResponse.json({ error: 'No se puede pagar un gasto cancelado', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'EXPENSE_ALREADY_PAID')          return NextResponse.json({ error: 'El gasto ya está pagado', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'EXPENSE_NOT_RECEIVED')          return NextResponse.json({ error: 'El gasto debe estar recibido para registrar un pago', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'EXPENSE_PAYMENT_BRANCH_REQUIRED') return NextResponse.json({ error: 'Se requiere sucursal para numerar el pago', code: 'EXPENSE_PAYMENT_BRANCH_REQUIRED' }, { status: 422 })
      if (err.message === 'BRANCH_NOT_FOUND')              return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
