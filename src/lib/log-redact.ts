const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
  'api_token',
  'access_token',
  'refresh_token',
  'DATABASE_URL',
] as const

export const REDACT_CENSOR = '[Redacted]'

/** Paths for pino's `redact` option: top-level and one nested level per sensitive key. */
export const REDACT_PATHS: string[] = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`])

const SENSITIVE_KEY_SET = new Set(SENSITIVE_KEYS.map((key) => key.toLowerCase()))

const MAX_DEPTH = 4

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Censors sensitive keys in a log-attributes object. Needed for sinks fed from the
 * pino `logMethod` hook (PostHog/OTel), which receives raw args that pino's own
 * `redact` never touches.
 */
export function redactAttributes(
  attributes: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_KEY_SET.has(key.toLowerCase())) {
      result[key] = REDACT_CENSOR
    } else if (isPlainObject(value) && depth < MAX_DEPTH) {
      result[key] = redactAttributes(value, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result
}
