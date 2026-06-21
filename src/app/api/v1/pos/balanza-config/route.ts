import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { balanzaConfigSchema } from '@/modules/pos/pos-config.schema'
import { getBalanzaConfig, updateBalanzaConfig } from '@/modules/pos/pos-config.service'

export const GET = withPermission('contacts:read', async (_req, _ctx, session) => {
  try {
    const ctx = await makeTenantContext(session.user)
    const balanza = await getBalanzaConfig(ctx.orgId)
    return NextResponse.json({ data: balanza })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const PUT = withPermission('contacts:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = balanzaConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const result = await updateBalanzaConfig(ctx.orgId, parsed.data)
    return NextResponse.json({ data: result.balanza })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'ORG_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
