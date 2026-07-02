import { describe, it, expect } from 'vitest'
import {
  isOrderInvoiceable,
  INVOICEABLE_ORDER_STATUSES,
  orderAcceptsShipmentCreation,
} from './sales-order-workflow'

describe('isOrderInvoiceable', () => {
  it('allows invoice from confirmed, in_progress and delivered', () => {
    for (const status of INVOICEABLE_ORDER_STATUSES) {
      expect(isOrderInvoiceable(status)).toBe(true)
    }
  })

  it('blocks invoice from draft and cancelled', () => {
    expect(isOrderInvoiceable('draft')).toBe(false)
    expect(isOrderInvoiceable('cancelled')).toBe(false)
  })
})

describe('orderAcceptsShipmentCreation', () => {
  const items = [{ quantity: '2', shipped_qty: '0' }]

  it('allows shipment while order is open', () => {
    expect(orderAcceptsShipmentCreation('confirmed', items)).toBe(true)
  })

  it('allows shipment on delivered order without logistics record', () => {
    expect(orderAcceptsShipmentCreation('delivered', items)).toBe(true)
  })

  it('blocks shipment on delivered order that is fully shipped', () => {
    expect(orderAcceptsShipmentCreation('delivered', [{ quantity: '2', shipped_qty: '2' }])).toBe(false)
  })

  it('blocks shipment when only services are pending', () => {
    expect(orderAcceptsShipmentCreation('confirmed', [
      { quantity: '2', shipped_qty: '0', product_type: 'service' },
    ])).toBe(false)
  })
})
