import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { requestCAEForCreditNote } from '@/modules/afip/afip-emission.service'
import { AFIP_ERROR_MAP } from '@/modules/afip/afip-http-errors'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const note = await requestCAEForCreditNote(id, tenantCtx)
    return NextResponse.json(note)
  } catch (err) {
    if (err instanceof Error && err.message in AFIP_ERROR_MAP) {
      const [message, status] = AFIP_ERROR_MAP[err.message]
      return NextResponse.json({ error: message, code: err.message }, { status })
    }
    throw err
  }
})
