import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { expenseUpdateSchema } from '@/modules/expenses/expense.schema'
import { getExpense, updateExpense, deleteExpense } from '@/modules/expenses/expenses.service'

export const GET = withPermission('expenses:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  try {
    const expense = await getExpense(id, orgScope.orgId)
    return NextResponse.json(expense)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EXPENSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = expenseUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const expense = await updateExpense(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(expense)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND') return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'EXPENSE_LOCKED')    return NextResponse.json({ error: 'El gasto está bloqueado y no puede editarse', code: 'EXPENSE_LOCKED' }, { status: 409 })
      if (err.message === 'EXPENSE_VALUES_LOCKED') {
        return NextResponse.json(
          { error: 'Los montos de un gasto confirmado no se editan directamente. Usá "Corregir" para volverlo a borrador.', code: 'EXPENSE_VALUES_LOCKED' },
          { status: 409 },
        )
      }
      if (err.message === 'INSTALLMENT_PLAN_AMOUNTS_LOCKED') {
        return NextResponse.json(
          { error: 'El total de un plan en cuotas surge de sus cuotas: editá los montos de cada cuota.', code: 'INSTALLMENT_PLAN_AMOUNTS_LOCKED' },
          { status: 409 },
        )
      }
      if (err.message === 'EXPENSE_ITEMS_LOCKED') {
        return NextResponse.json(
          { error: 'Las líneas solo se editan en borrador. Usá "Corregir" para volver el gasto a borrador.', code: 'EXPENSE_ITEMS_LOCKED' },
          { status: 409 },
        )
      }
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
    await deleteExpense(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND') return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'EXPENSE_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar gastos en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
