import { describe, it, expect } from 'vitest'
import {
  validateCuit,
  formatCuit,
  formatContactPersonLabel,
  normalizeContactTypeForImport,
  normalizeContactImportRow,
} from './contact.utils'

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

describe('normalizeContactTypeForImport', () => {
  it('keeps canonical API values', () => {
    expect(normalizeContactTypeForImport('customer')).toBe('customer')
    expect(normalizeContactTypeForImport('SUPPLIER')).toBe('supplier')
    expect(normalizeContactTypeForImport(' both ')).toBe('both')
  })

  it('maps Spanish labels from the CSV template', () => {
    expect(normalizeContactTypeForImport('Cliente')).toBe('customer')
    expect(normalizeContactTypeForImport('Proveedor')).toBe('supplier')
    expect(normalizeContactTypeForImport('Ambos')).toBe('both')
  })

  it('maps combined labels', () => {
    expect(normalizeContactTypeForImport('Cliente y proveedor')).toBe('both')
    expect(normalizeContactTypeForImport('Proveedor y cliente')).toBe('both')
  })

  it('returns undefined for empty input', () => {
    expect(normalizeContactTypeForImport(undefined)).toBeUndefined()
    expect(normalizeContactTypeForImport('')).toBeUndefined()
    expect(normalizeContactTypeForImport('   ')).toBeUndefined()
  })

  it('passes through unknown values for Zod to reject', () => {
    expect(normalizeContactTypeForImport('socio')).toBe('socio')
  })
})

describe('normalizeContactImportRow', () => {
  it('normalizes type only', () => {
    expect(
      normalizeContactImportRow({
        type: 'Cliente',
        legal_name: 'ACME S.A.',
        cuit: '30-69345023-9',
      }).type,
    ).toBe('customer')
  })
})

describe('formatContactPersonLabel', () => {
  it('returns null when both empty', () => {
    expect(formatContactPersonLabel({ first_name: null, last_name: null })).toBe(null)
    expect(formatContactPersonLabel({ first_name: '', last_name: '' })).toBe(null)
  })

  it('joins first and last name', () => {
    expect(formatContactPersonLabel({ first_name: 'Ana', last_name: 'García' })).toBe('Ana García')
  })

  it('handles single field', () => {
    expect(formatContactPersonLabel({ first_name: 'Ana', last_name: null })).toBe('Ana')
    expect(formatContactPersonLabel({ first_name: null, last_name: 'García' })).toBe('García')
  })
})
