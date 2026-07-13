import { describe, expect, it } from 'vitest'
import { computeNextRunAt, minIntervalSecondsOf, validateCronExpression } from './cron'

describe('computeNextRunAt', () => {
  it('computes the next fire time for a daily expression', () => {
    const from = new Date('2026-07-11T10:00:00Z')
    const next = computeNextRunAt('0 6 * * *', 'UTC', from)
    expect(next.toISOString()).toBe('2026-07-12T06:00:00.000Z')
  })

  it('respects the given timezone', () => {
    const from = new Date('2026-07-11T00:00:00Z')
    const next = computeNextRunAt('0 0 * * *', 'America/Argentina/Buenos_Aires', from)
    // 00:00 ART = 03:00 UTC
    expect(next.toISOString()).toBe('2026-07-11T03:00:00.000Z')
  })
})

describe('validateCronExpression', () => {
  it('accepts a valid 5-field expression', () => {
    expect(validateCronExpression('*/5 * * * *')).toEqual({ valid: true })
  })

  it('rejects a malformed expression', () => {
    const result = validateCronExpression('not a cron')
    expect(result.valid).toBe(false)
  })
})

describe('minIntervalSecondsOf', () => {
  it('returns 60 for a minute-by-minute expression', () => {
    const from = new Date('2026-07-11T10:00:00Z')
    expect(minIntervalSecondsOf('* * * * *', 'UTC', from)).toBe(60)
  })

  it('returns 3600 for an hourly expression', () => {
    const from = new Date('2026-07-11T10:00:00Z')
    expect(minIntervalSecondsOf('0 * * * *', 'UTC', from)).toBe(3600)
  })
})
