import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { organizationFiscalUpdateSchema } from '@/modules/auth/tenancy-admin.schema'
import {
  getOrganizationDetailForTenant,
  updateOrganizationFiscal,
} from '@/modules/auth/tenancy-admin.service'

export const GET = withSettingsPermission('settings:read', async (_req, _ctx, _session, orgId) => {
  try {
    const payload = await getOrganizationDetailForTenant(orgId)
    return NextResponse.json(payload)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withSettingsPermission('settings:write', async (req, _ctx, _session, orgId) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = organizationFiscalUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  try {
    const org = await updateOrganizationFiscal(orgId, parsed.data)
    return NextResponse.json({
      id: org.id,
      legal_name: org.legal_name,
      cuit: org.cuit,
      iva_condition: org.iva_condition,
      fiscal_address: org.fiscal_address,
      updated_at: org.updated_at.toISOString(),
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
