import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { updateExpenseInstallment } from '@/modules/expenses/expenses.service'

const installmentUpdateSchema = z.object({
  due_date: z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  amount: z.number().positive().optional(),
}).refine(data => data.due_date !== undefined || data.amount !== undefined, {
  message: 'Debe indicar una fecha de vencimiento o un monto',
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id, installmentId } = await ctx.params
  const body = await req.json()
  const parsed = installmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const installment = await updateExpenseInstallment(
      id,
      installmentId,
      { due_date: parsed.data.due_date, amount: parsed.data.amount },
      orgScope.orgId,
      resolveActorId(session),
    )
    return NextResponse.json(installment)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EXPENSE_NOT_FOUND') {
        return NextResponse.json({ error: 'Gasto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'INSTALLMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Cuota no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'EXPENSE_NOT_INSTALLMENT_PLAN') {
        return NextResponse.json({ error: 'El gasto no es un plan en cuotas', code: err.message }, { status: 409 })
      }
      if (err.message === 'EXPENSE_LOCKED') {
        return NextResponse.json({ error: 'El gasto está anulado y no puede editarse', code: err.message }, { status: 409 })
      }
      if (err.message === 'INSTALLMENT_NOT_PENDING') {
        return NextResponse.json(
          { error: 'Solo se pueden editar cuotas pendientes', code: err.message },
          { status: 409 },
        )
      }
    }
    throw err
  }
})
