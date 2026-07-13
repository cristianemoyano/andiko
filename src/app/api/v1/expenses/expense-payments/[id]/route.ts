import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { expensePaymentUpdateSchema } from '@/modules/expenses/expense-payment.schema'
import { getExpensePayment, updateExpensePayment, deleteExpensePayment } from '@/modules/expenses/expense-payments.service'

export const GET = withPermission('expenses:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const payment = await getExpensePayment(id, orgId)
    return NextResponse.json(payment)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EXPENSE_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago de gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = expensePaymentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const payment = await updateExpensePayment(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(payment)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EXPENSE_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago de gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission('expenses:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    await deleteExpensePayment(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EXPENSE_PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Pago de gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
