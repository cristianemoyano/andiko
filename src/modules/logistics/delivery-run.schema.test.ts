import { describe, expect, it } from 'vitest'
import {
  deliveryRunSchema,
  deliveryRunDispatchSchema,
  deliveryRunQuerySchema,
  eligibleShipmentQuerySchema,
} from './delivery-run.schema'

const shipmentId = 'e58ed763-928c-4155-bee9-fdbaaadc15f3'

describe('deliveryRunSchema', () => {
  it('accepts a minimal run with selected shipments', () => {
    const parsed = deliveryRunSchema.parse({ shipment_ids: [shipmentId] })
    expect(parsed.shipment_ids).toEqual([shipmentId])
  })

  it('requires at least one shipment', () => {
    expect(() => deliveryRunSchema.parse({ shipment_ids: [] })).toThrow()
  })

  it('rejects unknown provider kinds', () => {
    expect(() => deliveryRunSchema.parse({ shipment_ids: [shipmentId], provider_kind: 'bike' })).toThrow()
  })
})

describe('deliveryRunDispatchSchema', () => {
  it('allows dispatch without overrides', () => {
    expect(deliveryRunDispatchSchema.parse({})).toEqual({})
  })
})

describe('deliveryRunQuerySchema', () => {
  it('rejects inverted planned date ranges', () => {
    expect(() =>
      deliveryRunQuerySchema.parse({
        planned_from: '2026-07-03',
        planned_to: '2026-07-02',
      }),
    ).toThrow()
  })
})

describe('eligibleShipmentQuerySchema', () => {
  it('accepts filters used by the run builder UI', () => {
    const parsed = eligibleShipmentQuerySchema.parse({ postal_code: '5500', search: 'ENV' })
    expect(parsed.postal_code).toBe('5500')
    expect(parsed.search).toBe('ENV')
  })
})
