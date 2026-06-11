import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { deliveryNoteSchema, deliveryNoteQuerySchema } from '@/modules/inventory/delivery-note.schema'
import { listDeliveryNotes, createDeliveryNote } from '@/modules/inventory/delivery-notes.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code:  'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = deliveryNoteQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  const result = await listDeliveryNotes(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('inventory:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = deliveryNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  try {
    const note = await createDeliveryNote(parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(note, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND')     return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })
    }
    throw err
  }
})
