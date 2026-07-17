import 'server-only'
import crypto from 'node:crypto'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import User from './user.model'
import Organization from './organization.model'
import PasswordResetToken from './password-reset-token.model'
import { hashPassword } from './auth.service'
import { isThrottled, recordFailedAttempt, type ThrottleConfig } from '@/lib/rate-limit'
import { absoluteUrl } from '@/lib/absolute-url'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { passwordResetPayloadSchema } from '@/modules/notifications/notification.schema'

const RESET_TOKEN_TTL_MINUTES = 45
const RESET_THROTTLE: ThrottleConfig = { maxAttempts: 5, windowSeconds: 3600, lockSeconds: 3600 }

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Requests a password reset. ALWAYS resolves the same way whether or not the
 * email is registered — callers (the API route) must never branch on this,
 * to avoid leaking which emails exist. The throttle is recorded for both known
 * and unknown emails so the rate limit itself can't be used to fingerprint a
 * valid address by volume.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const throttleKey = `reset-password:${normalized}`

  const throttle = await isThrottled(throttleKey)
  if (throttle.blocked) return

  const user = await User.findOne({
    where: { email: normalized, is_active: true },
    attributes: ['id', 'email', 'name', 'org_id'],
  })

  await recordFailedAttempt(throttleKey, RESET_THROTTLE)

  if (!user) return

  if (!user.org_id) {
    // Sys-admin accounts have no org — the notifications pipeline requires one
    // (notifications.org_id is NOT NULL). Documented limitation, not an error.
    logger.warn({ userId: user.id }, 'password reset requested for org-less user, skipping email')
    return
  }

  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000)

  await sequelize.transaction(async (t) => {
    // A user can only have one live reset link at a time.
    await PasswordResetToken.destroy({ where: { user_id: user.id, used_at: null }, transaction: t })
    await PasswordResetToken.create(
      { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
      { transaction: t },
    )
  })

  // Non-blocking: the token already exists and is valid; a flaky SMTP server
  // must not undo that or fail the request. The user can always ask again.
  try {
    const organization = await Organization.findByPk(user.org_id, { attributes: ['name'] })
    const resetUrl = `${absoluteUrl('/reset-password')}?token=${rawToken}`
    const payload = passwordResetPayloadSchema.parse({
      user_id: user.id,
      user_name: user.name,
      org_name: organization?.name ?? 'Andiko',
      reset_url: resetUrl,
    })
    await emitNotification(
      {
        eventKey: 'auth.password_reset',
        recipient: { kind: 'email', address: user.email },
        payload,
        channels: ['email'],
      },
      { orgId: user.org_id, actorId: null },
    )
  } catch (err) {
    logger.error({ err, userId: user.id }, 'password reset email failed')
  }
}

/** Resets a user's password given a valid, unexpired, unused token. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = sha256Hex(token)
  const row = await PasswordResetToken.findOne({ where: { token_hash: tokenHash } })
  if (!row) throw new Error('TOKEN_INVALID')
  if (row.used_at) throw new Error('TOKEN_USED')
  if (row.expires_at.getTime() < Date.now()) throw new Error('TOKEN_EXPIRED')

  const password_hash = await hashPassword(newPassword)

  await sequelize.transaction(async (t) => {
    const [count] = await User.update(
      { password_hash },
      { where: { id: row.user_id, is_active: true }, transaction: t },
    )
    if (count === 0) throw new Error('USER_INACTIVE')

    await row.update({ used_at: new Date() }, { transaction: t })
    await PasswordResetToken.destroy({
      where: { user_id: row.user_id, id: { [Op.ne]: row.id }, used_at: null },
      transaction: t,
    })
  })
}
