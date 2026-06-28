import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { journalEntryUpdateSchema } from '@/modules/accounting/journal-entry.schema'
import { getEntry, updateEntry, deleteEntry } from '@/modules/accounting/journal-entries.service'
import { journalEntryErrorResponse } from '../../_errors'

type P = { id: string }

export const GET = withPermission<P>('accounting:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const entry = await getEntry(id, ctxTenant)
    return NextResponse.json(entry)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    return NextResponse.json({ error: 'Asiento no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('accounting:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const parsed = journalEntryUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const entry = await updateEntry(id, parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(entry)
  } catch (err: unknown) {
    const mapped = journalEntryErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})

export const DELETE = withPermission<P>('accounting:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    await deleteEntry(id, ctxTenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const mapped = journalEntryErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})
