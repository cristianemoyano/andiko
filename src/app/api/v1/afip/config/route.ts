import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { afipConfigSchema } from '@/modules/afip/afip.schema'
import { getAfipConfig, setBranchesPuntoVenta } from '@/modules/afip/afip-config.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
  const config = await getAfipConfig(ctx)
  return NextResponse.json(config)
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = afipConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const branches = await setBranchesPuntoVenta(parsed.data, ctx)
    return NextResponse.json({ branches })
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
