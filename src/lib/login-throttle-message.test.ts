import { describe, expect, it } from 'vitest'
import {
  LOGIN_THROTTLED_CODE_PREFIX,
  formatLoginThrottleMessage,
  parseLoginThrottledCode,
} from './login-throttle-message'

describe('parseLoginThrottledCode', () => {
  it('parses underscore throttle codes from signIn responses', () => {
    expect(parseLoginThrottledCode(`${LOGIN_THROTTLED_CODE_PREFIX}120`)).toBe(120)
  })

  it('parses legacy colon throttle codes', () => {
    expect(parseLoginThrottledCode('login_throttled:120')).toBe(120)
  })

  it('ignores unrelated codes', () => {
    expect(parseLoginThrottledCode('credentials')).toBeNull()
    expect(parseLoginThrottledCode(undefined)).toBeNull()
  })
})

describe('formatLoginThrottleMessage', () => {
  it('uses seconds for short lockouts', () => {
    expect(formatLoginThrottleMessage(45)).toBe(
      'Demasiados intentos fallidos. Probá de nuevo en 45 segundos.',
    )
  })

  it('uses rounded minutes for longer lockouts', () => {
    expect(formatLoginThrottleMessage(90)).toBe(
      'Demasiados intentos fallidos. Probá de nuevo en 2 minutos.',
    )
    expect(formatLoginThrottleMessage(60)).toBe(
      'Demasiados intentos fallidos. Probá de nuevo en 1 minuto.',
    )
  })
})
