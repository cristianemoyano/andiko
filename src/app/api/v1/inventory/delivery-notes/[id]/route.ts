import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { deliveryNoteUpdateSchema } from '@/modules/inventory/delivery-note.schema'
import { getDeliveryNote, updateDeliveryNote, deleteDeliveryNote } from '@/modules/inventory/delivery-notes.service'

export const GET = withPermission('inventory:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const note = await getDeliveryNote(id, orgId)
    return NextResponse.json(note)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DELIVERY_NOTE_NOT_FOUND') {
      return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('inventory:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = deliveryNoteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const note = await updateDeliveryNote(id, parsed.data, orgId, resolveActorId(session))
    return NextResponse.json(note)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'DELIVERY_NOTE_NOT_FOUND') return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DELIVERY_NOTE_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden editar remitos en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'CARRIER_ACCOUNT_NOT_FOUND') return NextResponse.json({ error: 'Transportista no encontrado', code: 'CARRIER_ACCOUNT_NOT_FOUND' }, { status: 404 })
      if (err.message === 'DOCUMENT_BRANCH_NOT_CHANGEABLE') {
        return NextResponse.json({ error: 'La sucursal solo se puede cambiar en remitos en borrador.', code: 'BRANCH_NOT_CHANGEABLE' }, { status: 409 })
      }
    }
    throw err
  }
})

export const DELETE = withPermission('inventory:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    await deleteDeliveryNote(id, orgId, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'DELIVERY_NOTE_NOT_FOUND') return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DELIVERY_NOTE_NOT_DRAFT') return NextResponse.json({ error: 'Solo se pueden eliminar remitos en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
