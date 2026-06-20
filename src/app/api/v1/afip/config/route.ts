import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { afipConfigSchema } from '@/modules/afip/afip.schema'
import { getAfipConfig, setBranchPuntoVenta } from '@/modules/afip/afip-config.service'
import { AFIP_ERROR_MAP } from '@/modules/afip/afip-http-errors'

export const GET = withPermission('sales:read', async (_req, _ctx, session) => {
  const ctx = await makeTenantContext(session.user)
  const config = await getAfipConfig(ctx)
  return NextResponse.json(config)
})

export const PUT = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = afipConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const branch = await setBranchPuntoVenta(parsed.data.branch_id, parsed.data.punto_venta, ctx)
    return NextResponse.json(branch)
  } catch (err) {
    if (err instanceof Error && err.message in AFIP_ERROR_MAP) {
      const [message, status] = AFIP_ERROR_MAP[err.message]
      return NextResponse.json({ error: message, code: err.message }, { status })
    }
    throw err
  }
})
