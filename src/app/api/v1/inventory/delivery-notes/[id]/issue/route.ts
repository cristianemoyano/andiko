import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { issueDeliveryNote } from '@/modules/inventory/delivery-notes.service'

export const POST = withPermission('inventory:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgId  = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json({ error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
  }

  try {
    const note = await issueDeliveryNote(id, orgId, resolveActorId(session))
    return NextResponse.json(note)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'DELIVERY_NOTE_NOT_FOUND')     return NextResponse.json({ error: 'Remito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'DELIVERY_NOTE_NOT_DRAFT')     return NextResponse.json({ error: 'El remito no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'DELIVERY_NOTE_NO_WAREHOUSE')  return NextResponse.json({ error: 'El remito debe tener un depósito asignado para descontar stock', code: 'DELIVERY_NOTE_NO_WAREHOUSE' }, { status: 422 })
      if (err.message === 'INSUFFICIENT_STOCK')          return NextResponse.json({ error: 'Stock insuficiente para uno de los productos', code: 'INSUFFICIENT_STOCK' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
