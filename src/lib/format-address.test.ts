import { describe, it, expect } from 'vitest'
import { formatAddress } from './format-address'

describe('formatAddress', () => {
  it('returns empty string when nothing is set', () => {
    expect(formatAddress({})).toBe('')
    expect(formatAddress({ street: '  ', city: null })).toBe('')
  })

  it('composes street and number', () => {
    expect(formatAddress({ street: 'Av. Siempreviva', number: '742' })).toBe('Av. Siempreviva 742')
  })

  it('includes floor and apartment after a dash', () => {
    expect(formatAddress({ street: 'Calle', number: '1', floor: '3', apartment: 'B' }))
      .toBe('Calle 1 - Piso 3 Dpto B')
  })

  it('appends city, province and postal code', () => {
    expect(formatAddress({ street: 'Calle', number: '1', city: 'Mendoza', province: 'Mendoza', postal_code: '5500' }))
      .toBe('Calle 1, Mendoza, Mendoza (5500)')
  })

  it('omits Argentina but keeps other countries', () => {
    expect(formatAddress({ city: 'Mendoza', country: 'Argentina' })).toBe('Mendoza')
    expect(formatAddress({ city: 'Montevideo', country: 'Uruguay' })).toBe('Montevideo, Uruguay')
  })
})
