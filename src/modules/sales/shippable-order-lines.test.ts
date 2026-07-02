import { describe, it, expect } from 'vitest'
import {
  isShippableLine,
  linePendingShipmentQty,
  orderHasPendingShipmentQty,
} from './shippable-order-lines'

describe('isShippableLine', () => {
  it('treats services as non-shippable', () => {
    expect(isShippableLine({ quantity: '1', product_type: 'service' })).toBe(false)
  })

  it('treats simple products and unknown lines as shippable', () => {
    expect(isShippableLine({ quantity: '1', product_type: 'simple' })).toBe(true)
    expect(isShippableLine({ quantity: '1' })).toBe(true)
  })
})

describe('orderHasPendingShipmentQty', () => {
  it('ignores service lines when checking pending qty', () => {
    expect(orderHasPendingShipmentQty([
      { quantity: '2', shipped_qty: '0', product_type: 'service' },
      { quantity: '5', shipped_qty: '5', product_type: 'simple' },
    ])).toBe(false)
  })

  it('detects pending physical qty', () => {
    expect(orderHasPendingShipmentQty([
      { quantity: '2', shipped_qty: '1', product_type: 'simple' },
      { quantity: '3', shipped_qty: '0', product_type: 'service' },
    ])).toBe(true)
  })
})

describe('linePendingShipmentQty', () => {
  it('returns remaining qty', () => {
    expect(linePendingShipmentQty({ quantity: '10', shipped_qty: '3' })).toBe(7)
  })
})
