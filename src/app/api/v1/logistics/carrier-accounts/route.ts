import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { logisticsErrorResponse } from '@/lib/logistics-route-errors'
import { carrierAccountQuerySchema, carrierAccountSchema } from '@/modules/logistics/carrier-account.schema'
import { listCarrierAccounts, createCarrierAccount } from '@/modules/logistics/carrier-accounts.service'

export const GET = withTenantPermission('sales:read', async (req, _ctx, _session, ctx) => {
  const parsed = carrierAccountQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listCarrierAccounts(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withTenantPermission('sales:write', async (req, _ctx, session, ctx) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = carrierAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const account = await createCarrierAccount(parsed.data, ctx, resolveActorId(session))
    return NextResponse.json(account, { status: 201 })
  } catch (err) {
    return logisticsErrorResponse(err)
  }
})
