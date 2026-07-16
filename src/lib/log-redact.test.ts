import { describe, it, expect } from 'vitest'
import { REDACT_CENSOR, REDACT_PATHS, redactAttributes } from './log-redact'

describe('REDACT_PATHS', () => {
  it('includes top-level and nested variants for each sensitive key', () => {
    expect(REDACT_PATHS).toContain('password')
    expect(REDACT_PATHS).toContain('*.password')
    expect(REDACT_PATHS).toContain('token')
    expect(REDACT_PATHS).toContain('*.token')
    expect(REDACT_PATHS).toContain('DATABASE_URL')
  })
})

describe('redactAttributes', () => {
  it('censors sensitive top-level keys', () => {
    const result = redactAttributes({ password: 'hunter2', email: 'a@b.com' })
    expect(result.password).toBe(REDACT_CENSOR)
    expect(result.email).toBe('a@b.com')
  })

  it('is case-insensitive on key names', () => {
    const result = redactAttributes({ Password: 'x', AUTHORIZATION: 'Bearer abc' })
    expect(result.Password).toBe(REDACT_CENSOR)
    expect(result.AUTHORIZATION).toBe(REDACT_CENSOR)
  })

  it('censors nested objects recursively', () => {
    const result = redactAttributes({
      user: { name: 'Ana', token: 'abc' },
      config: { smtp: { password: 'secret', host: 'smtp.test' } },
    })
    expect(result.user).toEqual({ name: 'Ana', token: REDACT_CENSOR })
    expect(result.config).toEqual({ smtp: { password: REDACT_CENSOR, host: 'smtp.test' } })
  })

  it('leaves non-sensitive values and non-object types untouched', () => {
    const input = { count: 3, tags: ['a', 'b'], active: true, note: null }
    expect(redactAttributes(input)).toEqual(input)
  })

  it('censors snake_case api keys and refresh tokens', () => {
    const result = redactAttributes({ api_key: 'k', refresh_token: 'r', access_token: 'a' })
    expect(result).toEqual({
      api_key: REDACT_CENSOR,
      refresh_token: REDACT_CENSOR,
      access_token: REDACT_CENSOR,
    })
  })
})
