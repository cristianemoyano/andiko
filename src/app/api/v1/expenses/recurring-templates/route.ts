import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import {
  recurringExpenseTemplateSchema,
  recurringExpenseTemplateQuerySchema,
} from '@/modules/expenses/recurring-expense-template.schema'
import {
  listRecurringExpenseTemplates,
  createRecurringExpenseTemplate,
} from '@/modules/expenses/recurring-expense-templates.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = recurringExpenseTemplateQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const result = await listRecurringExpenseTemplates(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('expenses:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = recurringExpenseTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const template = await createRecurringExpenseTemplate(parsed.data, orgId, resolveActorId(session))
  return NextResponse.json(template, { status: 201 })
})
