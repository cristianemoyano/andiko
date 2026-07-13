import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { recurringExpenseTemplateUpdateSchema } from '@/modules/expenses/recurring-expense-template.schema'
import {
  getRecurringExpenseTemplate,
  updateRecurringExpenseTemplate,
  deleteRecurringExpenseTemplate,
} from '@/modules/expenses/recurring-expense-templates.service'

export const GET = withPermission('expenses:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const template = await getRecurringExpenseTemplate(id, orgScope.orgId)
    return NextResponse.json(template)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'RECURRING_EXPENSE_TEMPLATE_NOT_FOUND') {
      return NextResponse.json({ error: 'Plantilla de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = recurringExpenseTemplateUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const template = await updateRecurringExpenseTemplate(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(template)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'RECURRING_EXPENSE_TEMPLATE_NOT_FOUND') {
      return NextResponse.json({ error: 'Plantilla de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
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
    await deleteRecurringExpenseTemplate(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'RECURRING_EXPENSE_TEMPLATE_NOT_FOUND') {
      return NextResponse.json({ error: 'Plantilla de gasto recurrente no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
