import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { posTicketFiscalSchema } from '@/modules/pos/pos-config.schema'
import { getPosConfig, updatePosTicketConfig } from '@/modules/pos/pos-config.service'

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  try {
    const ctx = await makeTenantContext(session.user)
    const config = await getPosConfig(ctx.orgId)
    return NextResponse.json({ data: config.ticket ?? {} })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = posTicketFiscalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const result = await updatePosTicketConfig(ctx.orgId, parsed.data ?? {})
    return NextResponse.json({ data: result.ticket ?? {} })
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
