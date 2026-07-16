import 'server-only'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import {
  emailTemplatesUpdateSchema,
  mergeEmailTemplates,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplates,
  type EmailTemplatesUpdateInput,
} from './email-template.schema'

/** Effective templates = defaults merged with per-org overrides. */
export async function getEffectiveEmailTemplates(orgId: string): Promise<EmailTemplates> {
  const row = await OrganizationSetting.findOne({ where: { org_id: orgId }, attributes: ['email_templates'] })
  return mergeEmailTemplates(row?.email_templates ?? null)
}

/**
 * Persist a partial templates update. Merges the incoming patch over the org's
 * current effective templates, validates the full result, then stores it.
 */
export async function updateEmailTemplates(
  orgId: string,
  input: EmailTemplatesUpdateInput,
): Promise<EmailTemplates> {
  // Validate the patch shape (already done at route, but defensive here too).
  emailTemplatesUpdateSchema.parse(input)

  const current = await getEffectiveEmailTemplates(orgId)
  const next: Record<string, unknown> = { ...current }
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const entry = input[key]
    if (entry) next[key] = entry
  }

  const existing = await OrganizationSetting.findOne({ where: { org_id: orgId } })
  if (existing) {
    await existing.update({ email_templates: next })
  } else {
    await OrganizationSetting.create({ org_id: orgId, email_templates: next })
  }
  return next as EmailTemplates
}
