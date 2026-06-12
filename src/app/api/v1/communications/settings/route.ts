import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { emailSettingsUpdateSchema } from '@/modules/communications/email-settings.schema'
import { getPublicEmailSettings, updateEmailSettings } from '@/modules/communications/email-settings.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code: 'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('sales:read', async (_req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })
  return NextResponse.json(await getPublicEmailSettings(orgId))
})

export const PUT = withPermission('sales:write', async (req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = emailSettingsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await updateEmailSettings(orgId, parsed.data)
  return NextResponse.json(result)
})
