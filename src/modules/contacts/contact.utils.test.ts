import { describe, it, expect } from 'vitest'
import { validateCuit, formatCuit } from './contact.utils'

describe('validateCuit', () => {
  it('validates a correct CUIT with dashes', () => {
    expect(validateCuit('30-69345023-9')).toBe(true)
  })

  it('validates a correct CUIT without dashes', () => {
    expect(validateCuit('30693450239')).toBe(true)
  })

  it('rejects a CUIT with wrong check digit', () => {
    expect(validateCuit('30-69345023-0')).toBe(false)
  })

  it('rejects a CUIT with wrong length', () => {
    expect(validateCuit('30-1234-5')).toBe(false)
  })

  it('rejects a CUIT with non-numeric characters', () => {
    expect(validateCuit('AB-69345023-9')).toBe(false)
  })

  it('validates another known valid CUIT', () => {
    expect(validateCuit('20-12345678-6')).toBe(true)
  })
})

describe('formatCuit', () => {
  it('formats an 11-digit string with dashes', () => {
    expect(formatCuit('30693450239')).toBe('30-69345023-9')
  })

  it('returns already-formatted CUIT unchanged', () => {
    expect(formatCuit('30-69345023-9')).toBe('30-69345023-9')
  })

  it('returns raw value if not 11 digits after stripping', () => {
    expect(formatCuit('123')).toBe('123')
  })
})
