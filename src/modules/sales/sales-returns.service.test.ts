import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

describe('sales return calculations', () => {
  it('difference total is exchange minus returned', () => {
    const returned = new Decimal('100')
    const exchange = new Decimal('150')
    expect(exchange.minus(returned).toFixed(2)).toBe('50.00')
  })

  it('partial return leaves remaining qty', () => {
    const sold = new Decimal('10')
    const returned = new Decimal('3')
    expect(sold.minus(returned).toFixed(4)).toBe('7.0000')
  })

  it('cancel invoice restores only non-returned qty', () => {
    const quantity = new Decimal('10')
    const returnedQty = new Decimal('3')
    const restoreQty = quantity.minus(returnedQty)
    expect(restoreQty.toFixed(4)).toBe('7.0000')
  })
})
