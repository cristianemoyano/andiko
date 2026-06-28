import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { annulDeliveryNote } from '@/modules/inventory/delivery-notes.service'

export const POST = withPermission('inventory:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  try {
    const note = await annulDeliveryNote(id, orgId, resolveActorId(session))
    return NextResponse.json(note)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'DELIVERY_NOTE_NOT_FOUND')      return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DELIVERY_NOTE_NOT_ANNULLABLE') return NextResponse.json({ error: 'Solo se pueden anular remitos emitidos o entregados', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'INSUFFICIENT_STOCK')           return NextResponse.json({ error: 'Stock insuficiente para revertir el movimiento', code: 'INSUFFICIENT_STOCK' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
