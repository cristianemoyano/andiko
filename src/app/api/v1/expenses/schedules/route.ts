import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import {
  expenseScheduleSchema,
  expenseScheduleQuerySchema,
} from '@/modules/expenses/expense-schedule.schema'
import {
  listExpenseSchedules,
  createExpenseSchedule,
} from '@/modules/expenses/expense-schedules.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = expenseScheduleQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const result = await listExpenseSchedules(parsed.data, orgScope.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('expenses:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = expenseScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const schedule = await createExpenseSchedule(parsed.data, orgScope.orgId, resolveActorId(session))
  return NextResponse.json(schedule, { status: 201 })
})
