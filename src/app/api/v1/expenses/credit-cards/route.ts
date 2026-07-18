import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import {
  creditCardSchema,
  creditCardQuerySchema,
} from '@/modules/expenses/credit-card.schema'
import {
  listCreditCards,
  createCreditCard,
} from '@/modules/expenses/credit-cards.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = creditCardQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const result = await listCreditCards(parsed.data, orgScope.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('expenses:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = creditCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const card = await createCreditCard(parsed.data, orgScope.orgId, resolveActorId(session))
  return NextResponse.json(card, { status: 201 })
})
