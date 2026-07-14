import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { expenseScheduleUpdateSchema } from '@/modules/expenses/expense-schedule.schema'
import {
  getExpenseSchedule,
  updateExpenseSchedule,
  deleteExpenseSchedule,
} from '@/modules/expenses/expense-schedules.service'

function isNotFound(err: unknown): boolean {
  return err instanceof Error && (
    err.message === 'EXPENSE_SCHEDULE_NOT_FOUND' ||
    err.message === 'RECURRING_EXPENSE_TEMPLATE_NOT_FOUND'
  )
}

/** @deprecated Prefer `/api/v1/expenses/schedules/:id` — alias kept for compatibility. */
export const GET = withPermission('expenses:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const schedule = await getExpenseSchedule(id, orgScope.orgId)
    return NextResponse.json(schedule)
  } catch (err: unknown) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: 'Serie de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = expenseScheduleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const schedule = await updateExpenseSchedule(id, parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(schedule)
  } catch (err: unknown) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: 'Serie de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission('expenses:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    await deleteExpenseSchedule(id, orgScope.orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: 'Serie de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
