import { describe, it, expect } from 'vitest'
import { computeOrderShipmentProgress, formatShipmentQty } from './order-shipment-progress'

describe('computeOrderShipmentProgress', () => {
  it('detects partial shipment on physical lines', () => {
    const progress = computeOrderShipmentProgress([
      { quantity: '10', shipped_qty: '3', product_type: 'simple' },
      { quantity: '2', shipped_qty: '0', product_type: 'service' },
    ])
    expect(progress.totalQty).toBe(10)
    expect(progress.shippedQty).toBe(3)
    expect(progress.pendingQty).toBe(7)
    expect(progress.isPartiallyShipped).toBe(true)
    expect(progress.isFullyShipped).toBe(false)
  })

  it('ignores services in totals', () => {
    const progress = computeOrderShipmentProgress([
      { quantity: '5', shipped_qty: '0', product_type: 'service' },
    ])
    expect(progress.hasShippableLines).toBe(false)
    expect(progress.isPartiallyShipped).toBe(false)
  })

  it('detects fully shipped physical lines', () => {
    const progress = computeOrderShipmentProgress([
      { quantity: '4', shipped_qty: '4', product_type: 'simple' },
    ])
    expect(progress.isFullyShipped).toBe(true)
    expect(progress.isPartiallyShipped).toBe(false)
  })
})

describe('formatShipmentQty', () => {
  it('trims trailing zeros', () => {
    expect(formatShipmentQty(8)).toBe('8')
    expect(formatShipmentQty(8.5)).toBe('8.5')
  })
})
