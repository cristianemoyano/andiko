import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { accountUpdateSchema } from '@/modules/accounting/account.schema'
import { getAccount, updateAccount, deleteAccount } from '@/modules/accounting/accounts.service'

type P = { id: string }

export const GET = withPermission<P>('accounting:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const account = await getAccount(id, ctxTenant)
    return NextResponse.json(account)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    return NextResponse.json({ error: 'Cuenta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('accounting:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const parsed = accountUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const account = await updateAccount(id, parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(account)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error) {
      if (err.message === 'ACCOUNT_NOT_FOUND') return NextResponse.json({ error: 'Cuenta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DUPLICATE_CODE')    return NextResponse.json({ error: 'Ya existe una cuenta con ese código', code: 'DUPLICATE_CODE' }, { status: 409 })
      if (err.message === 'PARENT_NOT_FOUND')  return NextResponse.json({ error: 'La cuenta padre no existe', code: 'PARENT_NOT_FOUND' }, { status: 422 })
      if (err.message === 'PARENT_CYCLE')      return NextResponse.json({ error: 'Una cuenta no puede ser su propio padre', code: 'PARENT_CYCLE' }, { status: 422 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('accounting:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    await deleteAccount(id, ctxTenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error) {
      if (err.message === 'ACCOUNT_NOT_FOUND')      return NextResponse.json({ error: 'Cuenta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'ACCOUNT_HAS_MOVEMENTS')  return NextResponse.json({ error: 'No se puede eliminar una cuenta con movimientos', code: 'ACCOUNT_HAS_MOVEMENTS' }, { status: 409 })
      if (err.message === 'ACCOUNT_HAS_CHILDREN')   return NextResponse.json({ error: 'No se puede eliminar una cuenta con subcuentas', code: 'ACCOUNT_HAS_CHILDREN' }, { status: 409 })
    }
    throw err
  }
})
