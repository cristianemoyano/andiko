import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { revertExpenseToDraft } from '@/modules/expenses/expenses.service'

export const POST = withPermission('expenses:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  try {
    const expense = await revertExpenseToDraft(id, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(expense)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND') {
        return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'EXPENSE_NOT_RECEIVED') {
        return NextResponse.json(
          { error: 'Solo se puede corregir un gasto confirmado sin pagos', code: err.message },
          { status: 409 },
        )
      }
      if (err.message === 'EXPENSE_HAS_PAYMENTS') {
        return NextResponse.json(
          { error: 'El gasto tiene pagos registrados. Eliminá los pagos antes de corregirlo.', code: err.message },
          { status: 409 },
        )
      }
      if (err.message === 'EXPENSE_FROM_CREDIT_CARD_STATEMENT') {
        return NextResponse.json(
          { error: 'Este gasto proviene de un resumen de tarjeta. Anulá el resumen y volvé a cargarlo.', code: err.message },
          { status: 409 },
        )
      }
    }
    throw err
  }
})
