import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { debitNoteQuerySchema, createDebitNoteSchema } from '@/modules/sales/debit-note.schema'
import { listDebitNotes, createDebitNote } from '@/modules/sales/debit-notes.service'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = debitNoteQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctx = await makeTenantContext(session.user)
  const result = await listDebitNotes(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = createDebitNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const ctx = await makeTenantContext(session.user)
  const note = await createDebitNote(parsed.data, ctx)
  return NextResponse.json(note, { status: 201 })
})
