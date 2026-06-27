import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

describe('purchase return calculations', () => {
  it('caps returnable quantity at received minus already returned', () => {
    const received = new Decimal('10')
    const alreadyReturned = new Decimal('3')
    const maxReturnable = received.minus(alreadyReturned)
    expect(maxReturnable.toFixed(4)).toBe('7.0000')
  })

  it('reduces supplier invoice balance by returned total', () => {
    const total = new Decimal('1000')
    const paid = new Decimal('200')
    const returned = new Decimal('300')
    const balance = Decimal.max(total.minus(paid).minus(returned), new Decimal(0))
    expect(balance.toFixed(2)).toBe('500.00')
  })

  it('floors the balance at zero when returns exceed outstanding', () => {
    const total = new Decimal('1000')
    const paid = new Decimal('800')
    const returned = new Decimal('500')
    const balance = Decimal.max(total.minus(paid).minus(returned), new Decimal(0))
    expect(balance.toFixed(2)).toBe('0.00')
  })

  it('exchange difference is replacement minus returned', () => {
    const returned = new Decimal('100')
    const exchange = new Decimal('150')
    expect(exchange.minus(returned).toFixed(2)).toBe('50.00')
  })

  it('net payable credit floors at zero when exchange costs more than the return', () => {
    const returnedTotal = new Decimal('100')
    const exchangeTotal = new Decimal('150')
    const netCredit = Decimal.max(returnedTotal.minus(exchangeTotal), new Decimal(0))
    expect(netCredit.toFixed(2)).toBe('0.00')
  })
})
