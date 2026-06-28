import { describe, expect, it } from 'vitest'
import {
  normalizeWooCountry,
  resolveWooCustomerLegalName,
  resolveWooCustomerPhone,
  wooAddressToContactInput,
  wooAddressesEqual,
  wooCustomerAddressInputs,
} from './woo-address.utils'

describe('wooAddressToContactInput', () => {
  it('maps billing to fiscal address', () => {
    const input = wooAddressToContactInput({
      address_1: 'Av. Corrientes 1234',
      address_2: 'Piso 5',
      city: 'CABA',
      state: 'CABA',
      postcode: '1043',
      country: 'AR',
    }, 'fiscal', true)

    expect(input).toMatchObject({
      type: 'fiscal',
      street: 'Av. Corrientes 1234',
      second_line: 'Piso 5',
      floor: null,
      apartment: null,
      city: 'CABA',
      province: 'CABA',
      postal_code: '1043',
      country: 'Argentina',
      is_default: true,
    })
  })

  it('returns null for empty address', () => {
    expect(wooAddressToContactInput({}, 'fiscal')).toBeNull()
  })
})

describe('wooCustomerAddressInputs', () => {
  it('creates fiscal and delivery when shipping differs', () => {
    const inputs = wooCustomerAddressInputs(
      { address_1: 'Billing 1', city: 'Rosario', state: 'SF' },
      { address_1: 'Shipping 9', city: 'Córdoba', state: 'CB' },
    )
    expect(inputs).toHaveLength(2)
    expect(inputs[0]?.type).toBe('fiscal')
    expect(inputs[1]?.type).toBe('delivery')
  })

  it('deduplicates identical billing and shipping', () => {
    const addr = {
      address_1: 'Same',
      city: 'Mendoza',
      state: 'MZ',
      first_name: 'Ana',
      company: 'Acme',
    }
    expect(wooCustomerAddressInputs(addr, addr)).toHaveLength(1)
  })

  it('creates delivery when only recipient or company differs', () => {
    const billing = {
      address_1: 'Testing st 2879',
      address_2: 'Piso 2nd line',
      city: 'Lujan de Cuyo',
      state: 'M',
      postcode: '5507',
      company: 'Testing Company',
      first_name: 'Juan',
      last_name: 'Lopez',
    }
    const shipping = {
      ...billing,
      address_1: 'Warehouse st 900',
      city: 'Mendoza',
      company: 'Ship To Co',
    }
    const inputs = wooCustomerAddressInputs(billing, shipping)
    expect(inputs).toHaveLength(2)
    expect(inputs[1]?.type).toBe('delivery')
    expect(inputs[1]?.street).toBe('Warehouse st 900')
  })

  it('skips empty shipping block', () => {
    const billing = { address_1: 'Billing 1', city: 'Rosario', state: 'SF' }
    expect(wooCustomerAddressInputs(billing, {})).toHaveLength(1)
  })
})

describe('resolveWooCustomerLegalName', () => {
  it('prefers billing company', () => {
    expect(resolveWooCustomerLegalName({
      id: 1,
      billing: { company: 'Acme SA', first_name: 'Juan' },
    }, 'Juan Pérez')).toBe('Acme SA')
  })
})

describe('resolveWooCustomerPhone', () => {
  it('prefers billing phone', () => {
    expect(resolveWooCustomerPhone({
      billing: { phone: '+54911' },
      shipping: { phone: '+54922' },
    })).toBe('+54911')
  })
})

describe('normalizeWooCountry', () => {
  it('maps AR to Argentina', () => {
    expect(normalizeWooCountry('AR')).toBe('Argentina')
  })
})

describe('wooAddressesEqual', () => {
  it('compares normalized address fields', () => {
    expect(wooAddressesEqual(
      { address_1: 'A', city: 'X' },
      { address_1: 'A', city: 'X' },
    )).toBe(true)
    expect(wooAddressesEqual(
      { address_1: 'A', city: 'X' },
      { address_1: 'B', city: 'X' },
    )).toBe(false)
  })
})
