import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { journalEntrySchema, journalEntryQuerySchema } from '@/modules/accounting/journal-entry.schema'
import { listEntries, createEntry } from '@/modules/accounting/journal-entries.service'
import { journalEntryErrorResponse } from '../_errors'

export const GET = withPermission('accounting:read', async (req, _ctx, session) => {
  const parsed = journalEntryQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const result = await listEntries(parsed.data, ctxTenant)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('accounting:write', async (req, _ctx, session) => {
  const parsed = journalEntrySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const entry = await createEntry(parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(entry, { status: 201 })
  } catch (err: unknown) {
    const mapped = journalEntryErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})
