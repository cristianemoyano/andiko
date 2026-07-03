import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { deliveryNoteSchema, deliveryNoteQuerySchema } from '@/modules/inventory/delivery-note.schema'
import { listDeliveryNotes, createDeliveryNote } from '@/modules/inventory/delivery-notes.service'

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = deliveryNoteQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const result = await listDeliveryNotes(parsed.data, orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('inventory:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = deliveryNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const note = await createDeliveryNote(parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(note, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND') return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      if (err.message === 'CARRIER_ACCOUNT_NOT_FOUND') return NextResponse.json({ error: 'Transportista no encontrado', code: 'CARRIER_ACCOUNT_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
