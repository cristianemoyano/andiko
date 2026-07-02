import { describe, it, expect } from 'vitest'
import { FULFILLMENT_KINDS } from '../logistics.constants'
import { getFulfillmentProvider, ProviderNotSupportedError, trackingUrlFor } from './index'

const destination = {
  name: 'Juan Pérez', phone: null, street: 'San Martín', number: '1234',
  floor: null, apartment: null, city: 'Mendoza', province: 'Mendoza',
  postal_code: '5500', country: 'Argentina',
}

const baseRequest = {
  shipmentNumber: 'ENV-01-0001',
  trackingNumber: null,
  destination,
  items: [{ description: 'Producto', quantity: '1.0000' }],
  notes: null,
}

describe('fulfillment provider registry', () => {
  it('resolves a provider for every kind, with matching kind', () => {
    for (const kind of FULFILLMENT_KINDS) {
      const provider = getFulfillmentProvider(kind)
      expect(provider.kind).toBe(kind)
      expect(provider.capabilities).toBeDefined()
    }
  })

  it('MVP providers cannot quote rates or print labels', () => {
    for (const kind of FULFILLMENT_KINDS) {
      const provider = getFulfillmentProvider(kind)
      expect(provider.capabilities.rates).toBe(false)
      expect(provider.capabilities.label).toBe(false)
      expect(provider.capabilities.autoTracking).toBe(false)
    }
  })

  it('getRate rejects with ProviderNotSupportedError', async () => {
    await expect(getFulfillmentProvider('in_house').getRate(baseRequest)).rejects.toBeInstanceOf(ProviderNotSupportedError)
    await expect(getFulfillmentProvider('andreani').getRate(baseRequest)).rejects.toBeInstanceOf(ProviderNotSupportedError)
  })
})

describe('in-house provider', () => {
  it('dispatch returns no tracking data (driver-driven flow)', async () => {
    const result = await getFulfillmentProvider('in_house').dispatch(baseRequest)
    expect(result).toEqual({ trackingNumber: null, trackingUrl: null, labelUrl: null, cost: null })
  })
})

describe('tracking-only provider', () => {
  it('dispatch echoes the operator-supplied tracking number and builds the URL', async () => {
    const result = await getFulfillmentProvider('andreani').dispatch({ ...baseRequest, trackingNumber: 'AND00012345' })
    expect(result.trackingNumber).toBe('AND00012345')
    expect(result.trackingUrl).toContain('AND00012345')
    expect(result.cost).toBeNull()
  })

  it('dispatch without tracking number yields no URL', async () => {
    const result = await getFulfillmentProvider('andreani').dispatch(baseRequest)
    expect(result.trackingNumber).toBeNull()
    expect(result.trackingUrl).toBeNull()
  })

  it('manual kind has no tracking URL template', () => {
    expect(trackingUrlFor('manual', 'X1')).toBeNull()
    expect(trackingUrlFor('in_house', 'X1')).toBeNull()
  })

  it('tracking URLs encode the tracking number', () => {
    expect(trackingUrlFor('oca', 'A B/C')).toContain('A%20B%2FC')
  })
})
