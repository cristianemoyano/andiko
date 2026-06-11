import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import PosDevice from '@/modules/pos/pos-device.model'

async function resolveDevice(id: string, orgId: string) {
  return PosDevice.findOne({ where: { id, org_id: orgId } })
}

export const POST = withPermission('contacts:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const device = await resolveDevice(id, tenantCtx.orgId)
    if (!device) return NextResponse.json({ error: 'Dispositivo no encontrado', code: 'NOT_FOUND' }, { status: 404 })

    const api_token = randomBytes(32).toString('hex')
    await device.update({ api_token })

    // Return token once so UI can show/copy it.
    return NextResponse.json({ ok: true, api_token })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

