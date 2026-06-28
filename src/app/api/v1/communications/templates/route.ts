import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
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

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const templates = await getEffectiveEmailTemplates(orgId)
  return NextResponse.json({
    templates,
    defaults: DEFAULT_EMAIL_TEMPLATES,
    labels: EMAIL_DOCUMENT_LABEL,
    variables: EMAIL_TEMPLATE_VARIABLES,
  })
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
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
