import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { creditNoteQuerySchema, createCreditNoteSchema } from '@/modules/sales/credit-note.schema'
import { listCreditNotes, createCreditNote } from '@/modules/sales/credit-notes.service'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = creditNoteQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
  const result = await listCreditNotes(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = createCreditNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
  const note = await createCreditNote(parsed.data, ctx)
  return NextResponse.json(note, { status: 201 })
})
