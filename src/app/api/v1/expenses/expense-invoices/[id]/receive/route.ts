import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { receiveExpense } from '@/modules/expenses/expenses.service'

export const POST = withPermission('expenses:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  try {
    const expense = await receiveExpense(id, orgId, resolveActorId(session))
    return NextResponse.json(expense)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND') return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'EXPENSE_NOT_DRAFT') return NextResponse.json({ error: 'El gasto no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
