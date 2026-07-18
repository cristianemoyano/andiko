import { NextResponse } from 'next/server'
import { UniqueConstraintError } from 'sequelize'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import {
  creditCardStatementSchema,
  creditCardStatementQuerySchema,
} from '@/modules/expenses/credit-card.schema'
import {
  listCreditCardStatements,
  createCreditCardStatement,
} from '@/modules/expenses/credit-cards.service'

export const GET = withPermission('expenses:read', async (req, _ctx, session) => {
  const parsed = creditCardStatementQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const result = await listCreditCardStatements(parsed.data, orgScope.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('expenses:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = creditCardStatementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const statement = await createCreditCardStatement(
      parsed.data,
      orgScope.orgId,
      resolveActorId(session),
    )
    return NextResponse.json(statement, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof UniqueConstraintError) {
      return NextResponse.json(
        { error: 'Ya existe un resumen para ese período', code: 'STATEMENT_PERIOD_EXISTS' },
        { status: 409 },
      )
    }
    if (err instanceof Error) {
      if (err.message === 'CREDIT_CARD_NOT_FOUND') {
        return NextResponse.json({ error: 'Tarjeta no encontrada', code: err.message }, { status: 404 })
      }
      if (err.message === 'CREDIT_CARD_INACTIVE') {
        return NextResponse.json({ error: 'La tarjeta está inactiva', code: err.message }, { status: 409 })
      }
      if (err.message === 'CREDIT_CARD_CONTACT_REQUIRED') {
        return NextResponse.json(
          { error: 'La tarjeta necesita un proveedor (emisor) asignado', code: err.message },
          { status: 422 },
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
