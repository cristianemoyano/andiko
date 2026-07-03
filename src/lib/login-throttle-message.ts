export const LOGIN_THROTTLED_CODE_PREFIX = 'login_throttled_'

/** Legacy Auth.js codes used ":" before switching to underscore. */
const LEGACY_LOGIN_THROTTLED_CODE_PREFIX = 'login_throttled:'

export function parseLoginThrottledCode(code: string | undefined): number | null {
  if (!code) return null
  for (const prefix of [LOGIN_THROTTLED_CODE_PREFIX, LEGACY_LOGIN_THROTTLED_CODE_PREFIX]) {
    if (!code.startsWith(prefix)) continue
    const seconds = Number.parseInt(code.slice(prefix.length), 10)
    if (Number.isFinite(seconds) && seconds > 0) return seconds
  }
  return null
}

export function formatLoginThrottleMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds < 60) {
    return `Demasiados intentos fallidos. Probá de nuevo en ${retryAfterSeconds} segundos.`
  }
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Demasiados intentos fallidos. Probá de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}.`
}

export async function fetchLoginThrottleSeconds(email: string): Promise<number | null> {
  const trimmed = email.trim()
  if (!trimmed) return null
  try {
    const res = await fetch(`/api/auth/login-throttle?${new URLSearchParams({ email: trimmed })}`)
    if (!res.ok) return null
    const data = (await res.json()) as { retryAfterSeconds?: number | null }
    return typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0
      ? data.retryAfterSeconds
      : null
  } catch {
    return null
  }
}
