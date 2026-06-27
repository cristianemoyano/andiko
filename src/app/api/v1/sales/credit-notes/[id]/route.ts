import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { updateCreditNoteSchema } from '@/modules/sales/credit-note.schema'
import { getCreditNote, updateCreditNote, deleteCreditNote } from '@/modules/sales/credit-notes.service'

type P = { id: string }

const ERROR_MAP: Record<string, [string, number]> = {
  CREDIT_NOTE_NOT_FOUND:      ['Nota de crédito no encontrada', 404],
  CREDIT_NOTE_NOT_EDITABLE:   ['La nota de crédito no se puede editar en su estado actual', 409],
  CREDIT_NOTE_NOT_DELETABLE:  ['Solo se pueden eliminar notas de crédito en borrador', 409],
  DOCUMENT_BRANCH_NOT_CHANGEABLE: ['La sucursal solo se puede cambiar en notas de crédito en borrador.', 409],
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message in ERROR_MAP) {
    const [message, status] = ERROR_MAP[err.message]
    return NextResponse.json({ error: message, code: err.message }, { status })
  }
  throw err
}

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const note = await getCreditNote(id, tenantCtx)
    return NextResponse.json(note)
  } catch (err) { return handleError(err) }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = updateCreditNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const note = await updateCreditNote(id, parsed.data, tenantCtx)
    return NextResponse.json(note)
  } catch (err) { return handleError(err) }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    await deleteCreditNote(id, tenantCtx)
    return new NextResponse(null, { status: 204 })
  } catch (err) { return handleError(err) }
})
