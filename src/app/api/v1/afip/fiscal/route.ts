import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { afipOrgFiscalSchema } from '@/modules/afip/afip.schema'
import { updateOrgFiscal } from '@/modules/afip/afip-config.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

export const PUT = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = afipOrgFiscalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const org = await updateOrgFiscal(parsed.data, ctx)
    return NextResponse.json({
      legal_name: org.legal_name,
      cuit: org.cuit,
      iva_condition: org.iva_condition,
      fiscal_address: org.fiscal_address,
    })
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
