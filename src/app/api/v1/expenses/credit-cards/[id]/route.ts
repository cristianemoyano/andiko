import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { creditCardUpdateSchema } from '@/modules/expenses/credit-card.schema'
import { getCreditCard, updateCreditCard } from '@/modules/expenses/credit-cards.service'

export const GET = withPermission('expenses:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const card = await getCreditCard(id, orgScope.orgId)
    return NextResponse.json(card)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CREDIT_CARD_NOT_FOUND') {
      return NextResponse.json({ error: 'Tarjeta no encontrada', code: 'CREDIT_CARD_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('expenses:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = creditCardUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const card = await updateCreditCard(id, parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(card)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CREDIT_CARD_NOT_FOUND') {
      return NextResponse.json({ error: 'Tarjeta no encontrada', code: 'CREDIT_CARD_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
