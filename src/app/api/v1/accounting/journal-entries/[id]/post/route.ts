import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { postEntry } from '@/modules/accounting/journal-entries.service'
import { journalEntryErrorResponse } from '../../../_errors'

type P = { id: string }

export const POST = withPermission<P>('accounting:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const entry = await postEntry(id, ctxTenant, resolveActorId(session))
    return NextResponse.json(entry)
  } catch (err: unknown) {
    const mapped = journalEntryErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})
