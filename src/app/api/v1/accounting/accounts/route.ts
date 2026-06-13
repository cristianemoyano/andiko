import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { accountSchema, accountQuerySchema } from '@/modules/accounting/account.schema'
import { listAccounts, createAccount } from '@/modules/accounting/accounts.service'

export const GET = withPermission('accounting:read', async (req, _ctx, session) => {
  const parsed = accountQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const result = await listAccounts(parsed.data, ctxTenant)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('accounting:write', async (req, _ctx, session) => {
  const parsed = accountSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const account = await createAccount(parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(account, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error) {
      if (err.message === 'DUPLICATE_CODE')   return NextResponse.json({ error: 'Ya existe una cuenta con ese código', code: 'DUPLICATE_CODE' }, { status: 409 })
      if (err.message === 'PARENT_NOT_FOUND') return NextResponse.json({ error: 'La cuenta padre no existe', code: 'PARENT_NOT_FOUND' }, { status: 422 })
    }
    throw err
  }
})
