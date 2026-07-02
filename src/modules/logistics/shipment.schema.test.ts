import { describe, it, expect } from 'vitest'
import { shipmentSchema, shipmentEventInputSchema, shipmentFailSchema } from './shipment.schema'

const base = {
  sales_order_id: 'e58ed763-928c-4155-bee9-fdbaaadc15f3',
  carrier_account_id: '0b0f8b53-8ecc-4bcb-a7c5-4c9c1f6b0f11',
}

describe('shipmentSchema', () => {
  it('accepts a minimal payload (items defaults to pending order lines)', () => {
    const parsed = shipmentSchema.parse(base)
    expect(parsed.items).toBeUndefined()
  })

  it('rejects non-positive item quantities', () => {
    expect(() =>
      shipmentSchema.parse({
        ...base,
        items: [{ sales_order_item_id: base.sales_order_id, quantity: 0 }],
      }),
    ).toThrow()
  })

  it('rejects an empty items array', () => {
    expect(() => shipmentSchema.parse({ ...base, items: [] })).toThrow()
  })

  it('rejects negative shipping cost', () => {
    expect(() => shipmentSchema.parse({ ...base, shipping_cost: -1 })).toThrow()
  })
})

describe('shipmentEventInputSchema', () => {
  it('rejects unknown statuses', () => {
    expect(() => shipmentEventInputSchema.parse({ status: 'lost' })).toThrow()
  })

  it('coerces occurred_at into a Date', () => {
    const parsed = shipmentEventInputSchema.parse({ status: 'in_transit', occurred_at: '2026-07-02T10:00:00Z' })
    expect(parsed.occurred_at).toBeInstanceOf(Date)
  })
})

describe('shipmentFailSchema', () => {
  it('requires a reason', () => {
    expect(() => shipmentFailSchema.parse({ reason: '' })).toThrow()
    expect(shipmentFailSchema.parse({ reason: 'Domicilio cerrado' }).reason).toBe('Domicilio cerrado')
  })
})
