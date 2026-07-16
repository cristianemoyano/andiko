import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/config/env', () => ({ env: { AUTH_URL: 'https://erp.test' } }))
vi.mock('./organization.model', () => ({
  default: { findByPk: vi.fn() },
}))
vi.mock('@/modules/communications/email-templates.service', () => ({
  getEffectiveEmailTemplates: vi.fn(),
}))
vi.mock('@/modules/notifications/emit-notification.service', () => ({
  emitNotification: vi.fn().mockResolvedValue({ status: 'sent' }),
}))

import Organization from './organization.model'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { sendUserWelcomeEmail } from './user-welcome-notification.service'

const user = { id: '550e8400-e29b-41d4-a716-446655440010', email: 'ana@test.com', name: 'Ana', org_id: 'org-1' }

beforeEach(() => {
  vi.clearAllMocks()
  ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ user_welcome: { enabled: true } })
  ;(Organization.findByPk as Mock).mockResolvedValue({ name: 'Mi Empresa' })
})

describe('sendUserWelcomeEmail', () => {
  it('sends the welcome email with a login link and no password', async () => {
    await sendUserWelcomeEmail(user, 'actor-1')

    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'auth.user_welcome',
        recipient: { kind: 'email', address: 'ana@test.com' },
        payload: expect.objectContaining({
          user_name: 'Ana',
          org_name: 'Mi Empresa',
          login_url: 'https://erp.test/login',
        }),
      }),
      { orgId: 'org-1', actorId: 'actor-1' },
    )
    const [[payload]] = (emitNotification as Mock).mock.calls
    expect(JSON.stringify(payload)).not.toContain('password')
  })

  it('does nothing when the org disabled the welcome template', async () => {
    ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ user_welcome: { enabled: false } })

    await sendUserWelcomeEmail(user, 'actor-1')

    expect(emitNotification).not.toHaveBeenCalled()
  })
})
