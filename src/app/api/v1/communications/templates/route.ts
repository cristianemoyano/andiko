import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_DOCUMENT_LABEL,
  EMAIL_TEMPLATE_VARIABLES,
  emailTemplatesUpdateSchema,
} from '@/modules/communications/email-template.schema'
import {
  getEffectiveEmailTemplates,
  updateEmailTemplates,
} from '@/modules/communications/email-templates.service'

const ORG_REQUIRED_RESPONSE = {
  error: 'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
  code: 'ORG_CONTEXT_REQUIRED',
}

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })
  const templates = await getEffectiveEmailTemplates(orgId)
  return NextResponse.json({
    templates,
    defaults: DEFAULT_EMAIL_TEMPLATES,
    labels: EMAIL_DOCUMENT_LABEL,
    variables: EMAIL_TEMPLATE_VARIABLES,
  })
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) return NextResponse.json(ORG_REQUIRED_RESPONSE, { status: 422 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = emailTemplatesUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const templates = await updateEmailTemplates(orgId, parsed.data)
  return NextResponse.json({ templates })
})
