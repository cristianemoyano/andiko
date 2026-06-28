import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { markDeliveryNoteDelivered } from '@/modules/inventory/delivery-notes.service'

export const POST = withPermission('inventory:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const note = await markDeliveryNoteDelivered(id, orgId, resolveActorId(session))
    return NextResponse.json(note)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'DELIVERY_NOTE_NOT_FOUND')  return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DELIVERY_NOTE_NOT_ISSUED') return NextResponse.json({ error: 'El remito debe estar emitido para marcarlo como entregado', code: 'INVALID_STATUS' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
