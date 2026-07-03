import 'server-only'
import { QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'

export type ThrottleConfig = {
  /** Failed attempts allowed inside `windowSeconds` before locking the key out. */
  maxAttempts: number
  /** Rolling window in which attempts are counted. */
  windowSeconds: number
  /** How long the key stays locked once `maxAttempts` is reached. */
  lockSeconds: number
}

export type ThrottleStatus = {
  blocked: boolean
  retryAfterSeconds: number
}

const NOT_BLOCKED: ThrottleStatus = { blocked: false, retryAfterSeconds: 0 }

function statusFromLockedUntil(lockedUntil: string | Date | null): ThrottleStatus {
  if (!lockedUntil) return NOT_BLOCKED
  const remainingMs = new Date(lockedUntil).getTime() - Date.now()
  if (remainingMs <= 0) return NOT_BLOCKED
  return { blocked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) }
}

/**
 * Checks whether `key` is currently locked out, without recording an attempt. Call this
 * BEFORE doing the expensive/sensitive work (bcrypt compare, credential lookup) so a
 * locked-out caller never reaches it.
 */
export async function isThrottled(key: string): Promise<ThrottleStatus> {
  const rows = await sequelize.query<{ locked_until: string | null }>(
    `SELECT locked_until FROM auth_throttles WHERE throttle_key = :key`,
    { replacements: { key }, type: QueryTypes.SELECT },
  )
  return statusFromLockedUntil(rows[0]?.locked_until ?? null)
}

/**
 * Records a failed attempt for `key`, atomically incrementing the rolling-window counter and
 * locking the key out once `maxAttempts` is reached. Safe under concurrent calls (single
 * upsert statement, no read-then-write race).
 */
export async function recordFailedAttempt(
  key: string,
  { maxAttempts, windowSeconds, lockSeconds }: ThrottleConfig,
): Promise<ThrottleStatus> {
  const rows = await sequelize.query<{ locked_until: string | null }>(
    `
    INSERT INTO auth_throttles (throttle_key, attempt_count, window_started_at, locked_until, updated_at)
    VALUES (:key, 1, NOW(), NULL, NOW())
    ON CONFLICT (throttle_key) DO UPDATE SET
      attempt_count = CASE
        WHEN auth_throttles.window_started_at < NOW() - make_interval(secs => :windowSeconds) THEN 1
        ELSE auth_throttles.attempt_count + 1
      END,
      window_started_at = CASE
        WHEN auth_throttles.window_started_at < NOW() - make_interval(secs => :windowSeconds) THEN NOW()
        ELSE auth_throttles.window_started_at
      END,
      locked_until = CASE
        WHEN auth_throttles.window_started_at < NOW() - make_interval(secs => :windowSeconds) THEN NULL
        WHEN auth_throttles.attempt_count + 1 >= :maxAttempts THEN NOW() + make_interval(secs => :lockSeconds)
        ELSE auth_throttles.locked_until
      END,
      updated_at = NOW()
    RETURNING locked_until
    `,
    {
      replacements: { key, windowSeconds, maxAttempts, lockSeconds },
      type: QueryTypes.SELECT,
    },
  )
  return statusFromLockedUntil(rows[0]?.locked_until ?? null)
}

/** Clears throttle state for `key`, e.g. after a successful login/PIN check. */
export async function clearThrottle(key: string): Promise<void> {
  await sequelize.query(`DELETE FROM auth_throttles WHERE throttle_key = :key`, {
    replacements: { key },
    type: QueryTypes.DELETE,
  })
}
