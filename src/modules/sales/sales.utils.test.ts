import { describe, it, expect } from 'vitest'
import { calcLineItem, calcDocumentTotals } from './sales.math'

describe('calcLineItem', () => {
  it('calculates totals with 21% IVA', () => {
    const result = calcLineItem(2, 100, 0, '21')
    expect(result.subtotal).toBe('200.00')
    expect(result.discount_amount).toBe('0.00')
    expect(result.tax_base).toBe('200.00')
    expect(result.tax_amount).toBe('42.00')
    expect(result.total).toBe('242.00')
  })

  it('applies discount before IVA', () => {
    const result = calcLineItem(1, 1000, 10, '21')
    expect(result.subtotal).toBe('1000.00')
    expect(result.discount_amount).toBe('100.00')
    expect(result.tax_base).toBe('900.00')
    expect(result.tax_amount).toBe('189.00')
    expect(result.total).toBe('1089.00')
  })

  it('handles 0% IVA (exempt products)', () => {
    const result = calcLineItem(5, 200, 0, '0')
    expect(result.tax_amount).toBe('0.00')
    expect(result.total).toBe('1000.00')
  })

  it('handles 10.5% IVA', () => {
    const result = calcLineItem(1, 100, 0, '10.5')
    expect(result.tax_amount).toBe('10.50')
    expect(result.total).toBe('110.50')
  })

  it('handles 27% IVA', () => {
    const result = calcLineItem(1, 100, 0, '27')
    expect(result.tax_amount).toBe('27.00')
    expect(result.total).toBe('127.00')
  })

  it('handles fractional quantities with correct precision', () => {
    const result = calcLineItem('2.5', 100, 0, '21')
    expect(result.subtotal).toBe('250.00')
    expect(result.tax_amount).toBe('52.50')
    expect(result.total).toBe('302.50')
  })

  it('handles 100% discount resulting in zero totals', () => {
    const result = calcLineItem(1, 500, 100, '21')
    expect(result.discount_amount).toBe('500.00')
    expect(result.tax_base).toBe('0.00')
    expect(result.tax_amount).toBe('0.00')
    expect(result.total).toBe('0.00')
  })

  it('returns string values (not numbers) for DB storage', () => {
    const result = calcLineItem(1, 100, 0, '21')
    expect(typeof result.total).toBe('string')
    expect(typeof result.tax_amount).toBe('string')
  })
})

describe('calcDocumentTotals', () => {
  it('sums multiple line items', () => {
    const items = [
      calcLineItem(1, 100, 0, '21'),
      calcLineItem(2, 50, 0, '21'),
    ]
    const totals = calcDocumentTotals(items)
    expect(totals.subtotal).toBe('200.00')
    expect(totals.tax_amount).toBe('42.00')
    expect(totals.total).toBe('242.00')
  })

  it('handles mixed IVA rates', () => {
    const items = [
      calcLineItem(1, 100, 0, '21'),
      calcLineItem(1, 100, 0, '10.5'),
    ]
    const totals = calcDocumentTotals(items)
    expect(totals.subtotal).toBe('200.00')
    expect(totals.tax_amount).toBe('31.50')
    expect(totals.total).toBe('231.50')
  })

  it('handles empty array', () => {
    const totals = calcDocumentTotals([])
    expect(totals.subtotal).toBe('0.00')
    expect(totals.total).toBe('0.00')
  })

  it('accumulates discounts correctly', () => {
    const items = [
      calcLineItem(1, 1000, 10, '21'),
      calcLineItem(1, 500, 20, '21'),
    ]
    const totals = calcDocumentTotals(items)
    expect(totals.discount_amount).toBe('200.00')
  })
})
