import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { creditCardStatementAmountsSchema } from '@/modules/expenses/credit-card.schema'
import { updateCreditCardStatementAmounts } from '@/modules/expenses/credit-cards.service'

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = creditCardStatementAmountsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const statement = await updateCreditCardStatementAmounts(
      id,
      parsed.data,
      orgScope.orgId,
      resolveActorId(session),
    )
    return NextResponse.json(statement)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'STATEMENT_NOT_FOUND' || err.message === 'EXPENSE_NOT_FOUND') {
        return NextResponse.json({ error: 'Resumen no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'STATEMENT_CANCELLED') {
        return NextResponse.json(
          { error: 'El resumen está anulado y no puede editarse', code: err.message },
          { status: 409 },
        )
      }
      if (err.message === 'STATEMENT_LOCKED') {
        return NextResponse.json(
          { error: 'El gasto del resumen ya está pagado o anulado', code: err.message },
          { status: 409 },
        )
      }
      if (err.message === 'STATEMENT_HAS_PAYMENTS') {
        return NextResponse.json(
          { error: 'El resumen tiene pagos registrados. Eliminá los pagos antes de corregir los montos.', code: err.message },
          { status: 409 },
        )
      }
      if (err.message === 'CREDIT_CARD_STATEMENT_AMOUNT_REQUIRED') {
        return NextResponse.json(
          { error: 'Indicá un monto en ARS y/o USD', code: err.message },
          { status: 422 },
        )
      }
    }
    throw err
  }
})
