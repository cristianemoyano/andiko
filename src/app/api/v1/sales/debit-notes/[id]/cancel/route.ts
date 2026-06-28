import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { cancelDebitNote } from '@/modules/sales/debit-notes.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const note = await cancelDebitNote(id, tenantCtx)
    return NextResponse.json(note)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'DEBIT_NOTE_NOT_FOUND') return NextResponse.json({ error: 'Nota de débito no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'DEBIT_NOTE_ALREADY_CANCELLED') return NextResponse.json({ error: 'La nota de débito ya fue anulada', code: err.message }, { status: 409 })
    }
    throw err
  }
})
