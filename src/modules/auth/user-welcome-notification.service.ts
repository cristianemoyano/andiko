import 'server-only'
import Organization from './organization.model'
import { absoluteUrl } from '@/lib/absolute-url'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { userWelcomePayloadSchema } from '@/modules/notifications/notification.schema'

export interface WelcomeUser {
  id: string
  email: string
  name: string
  org_id: string
}

/**
 * Sends the "bienvenida" email for a newly created org user, unless the org
 * has that template disabled. Must only be called AFTER the user's creation
 * transaction has committed — callers must catch failures instead of letting
 * them fail the user creation. Never includes the password in the body.
 */
export async function sendUserWelcomeEmail(user: WelcomeUser, actorId: string | null): Promise<void> {
  const templates = await getEffectiveEmailTemplates(user.org_id)
  if (!templates.user_welcome.enabled) return

  const organization = await Organization.findByPk(user.org_id, { attributes: ['name'] })

  const payload = userWelcomePayloadSchema.parse({
    user_id: user.id,
    user_name: user.name,
    org_name: organization?.name ?? 'Andiko',
    login_url: absoluteUrl('/login'),
  })

  await emitNotification(
    {
      eventKey: 'auth.user_welcome',
      recipient: { kind: 'email', address: user.email },
      payload,
      channels: ['email'],
    },
    { orgId: user.org_id, actorId },
  )
}
