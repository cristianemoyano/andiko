import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/config/env', () => ({ env: { AUTH_URL: 'https://erp.test' } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb: (t: unknown) => unknown) => cb({})) } }))

vi.mock('./user.model', () => ({
  default: { findOne: vi.fn(), update: vi.fn() },
}))
vi.mock('./organization.model', () => ({
  default: { findByPk: vi.fn() },
}))
vi.mock('./password-reset-token.model', () => ({
  default: { findOne: vi.fn(), create: vi.fn(), destroy: vi.fn() },
}))
vi.mock('./auth.service', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}))
vi.mock('@/lib/rate-limit', () => ({
  isThrottled: vi.fn().mockResolvedValue({ blocked: false, retryAfterSeconds: 0 }),
  recordFailedAttempt: vi.fn().mockResolvedValue({ blocked: false, retryAfterSeconds: 0 }),
}))
vi.mock('@/modules/notifications/emit-notification.service', () => ({
  emitNotification: vi.fn().mockResolvedValue({ status: 'sent' }),
}))

import User from './user.model'
import Organization from './organization.model'
import PasswordResetToken from './password-reset-token.model'
import logger from '@/lib/logger'
import { isThrottled, recordFailedAttempt } from '@/lib/rate-limit'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { requestPasswordReset, resetPassword } from './password-reset.service'

beforeEach(() => vi.clearAllMocks())

describe('requestPasswordReset', () => {
  it('short-circuits without any DB writes when throttled', async () => {
    ;(isThrottled as Mock).mockResolvedValueOnce({ blocked: true, retryAfterSeconds: 300 })

    await requestPasswordReset('user@test.com')

    expect(User.findOne).not.toHaveBeenCalled()
    expect(PasswordResetToken.create).not.toHaveBeenCalled()
  })

  it('records a throttle attempt and creates no token for an unknown email', async () => {
    ;(User.findOne as Mock).mockResolvedValue(null)

    await requestPasswordReset('unknown@test.com')

    expect(recordFailedAttempt).toHaveBeenCalledWith('reset-password:unknown@test.com', expect.anything())
    expect(PasswordResetToken.create).not.toHaveBeenCalled()
    expect(emitNotification).not.toHaveBeenCalled()
  })

  it('skips token creation and email for an org-less (sys-admin) user', async () => {
    ;(User.findOne as Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440010', email: 'admin@test.com', name: 'Admin', org_id: null })

    await requestPasswordReset('admin@test.com')

    expect(PasswordResetToken.create).not.toHaveBeenCalled()
    expect(emitNotification).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('creates a token and sends the reset email for a known org user', async () => {
    ;(User.findOne as Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440010', email: 'user@test.com', name: 'Ana', org_id: 'org-1' })
    ;(Organization.findByPk as Mock).mockResolvedValue({ name: 'Mi Empresa' })

    await requestPasswordReset('USER@test.com')

    expect(PasswordResetToken.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: '550e8400-e29b-41d4-a716-446655440010', used_at: null } }),
    )
    expect(PasswordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: '550e8400-e29b-41d4-a716-446655440010', token_hash: expect.any(String), expires_at: expect.any(Date) }),
      expect.anything(),
    )
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'auth.password_reset',
        recipient: { kind: 'email', address: 'user@test.com' },
        payload: expect.objectContaining({
          user_name: 'Ana',
          org_name: 'Mi Empresa',
          reset_url: expect.stringContaining('https://erp.test/reset-password?token='),
        }),
      }),
      { orgId: 'org-1', actorId: null },
    )
  })

  it('does not throw when the token was created but the email send fails', async () => {
    ;(User.findOne as Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440010', email: 'user@test.com', name: 'Ana', org_id: 'org-1' })
    ;(Organization.findByPk as Mock).mockResolvedValue({ name: 'Mi Empresa' })
    ;(emitNotification as Mock).mockRejectedValueOnce(new Error('EMAIL_SEND_FAILED'))

    await expect(requestPasswordReset('user@test.com')).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  it('throws TOKEN_INVALID when the hash has no matching row', async () => {
    ;(PasswordResetToken.findOne as Mock).mockResolvedValue(null)
    await expect(resetPassword('some-token', 'new-password-123')).rejects.toThrow('TOKEN_INVALID')
  })

  it('throws TOKEN_USED when the token was already consumed', async () => {
    ;(PasswordResetToken.findOne as Mock).mockResolvedValue({
      id: 'tok-1', user_id: '550e8400-e29b-41d4-a716-446655440010', used_at: new Date(), expires_at: new Date(Date.now() + 60_000),
    })
    await expect(resetPassword('some-token', 'new-password-123')).rejects.toThrow('TOKEN_USED')
  })

  it('throws TOKEN_EXPIRED when past expires_at', async () => {
    ;(PasswordResetToken.findOne as Mock).mockResolvedValue({
      id: 'tok-1', user_id: '550e8400-e29b-41d4-a716-446655440010', used_at: null, expires_at: new Date(Date.now() - 60_000),
    })
    await expect(resetPassword('some-token', 'new-password-123')).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('updates the password, marks the token used, and clears sibling tokens', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    ;(PasswordResetToken.findOne as Mock).mockResolvedValue({
      id: 'tok-1', user_id: '550e8400-e29b-41d4-a716-446655440010', used_at: null, expires_at: new Date(Date.now() + 60_000), update,
    })
    ;(User.update as Mock).mockResolvedValue([1])

    await resetPassword('some-token', 'new-password-123')

    expect(User.update).toHaveBeenCalledWith(
      { password_hash: 'hashed-password' },
      expect.objectContaining({ where: { id: '550e8400-e29b-41d4-a716-446655440010', is_active: true } }),
    )
    expect(update).toHaveBeenCalledWith({ used_at: expect.any(Date) }, expect.anything())
    expect(PasswordResetToken.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: '550e8400-e29b-41d4-a716-446655440010' }) }),
    )
  })

  it('throws USER_INACTIVE when the user row cannot be updated', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    ;(PasswordResetToken.findOne as Mock).mockResolvedValue({
      id: 'tok-1', user_id: '550e8400-e29b-41d4-a716-446655440010', used_at: null, expires_at: new Date(Date.now() + 60_000), update,
    })
    ;(User.update as Mock).mockResolvedValue([0])

    await expect(resetPassword('some-token', 'new-password-123')).rejects.toThrow('USER_INACTIVE')
  })
})
