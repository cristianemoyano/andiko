import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ default: {} }))

import { calcExpenseTotals, advanceNextRunDate } from './expenses.utils'

describe('calcExpenseTotals', () => {
  it('computes net, IVA, and total from subtotal/discount/rate', () => {
    const totals = calcExpenseTotals('100.00', '0.00', '21')
    expect(totals).toEqual({
      subtotal: '100.00',
      discount_amount: '0.00',
      tax_amount: '21.00',
      total: '121.00',
    })
  })

  it('applies the discount before computing IVA', () => {
    const totals = calcExpenseTotals('100.00', '10.00', '21')
    expect(totals.tax_amount).toBe('18.90')
    expect(totals.total).toBe('108.90')
  })

  it('handles a 0% IVA rate', () => {
    const totals = calcExpenseTotals('50.00', '0.00', '0')
    expect(totals.tax_amount).toBe('0.00')
    expect(totals.total).toBe('50.00')
  })
})

describe('advanceNextRunDate', () => {
  it('advances by one calendar month for "monthly"', () => {
    const next = advanceNextRunDate(new Date('2026-07-13T00:00:00Z'), 'monthly')
    expect(next.getUTCMonth()).toBe(7) // August (0-indexed)
    expect(next.getUTCDate()).toBe(13)
  })

  it('advances by 7 days for "weekly"', () => {
    const next = advanceNextRunDate(new Date('2026-07-13T00:00:00Z'), 'weekly')
    expect(next.toISOString().slice(0, 10)).toBe('2026-07-20')
  })

  it('clamps a day-31 anchor to Feb 28 in a non-leap year instead of overflowing into March', () => {
    const next = advanceNextRunDate(new Date('2026-01-31T00:00:00Z'), 'monthly')
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('clamps a day-31 anchor to Feb 29 in a leap year', () => {
    const next = advanceNextRunDate(new Date('2028-01-31T00:00:00Z'), 'monthly')
    expect(next.toISOString().slice(0, 10)).toBe('2028-02-29')
  })

  it('does not keep drifting once clamped — Feb 28 advances to Mar 28, not back to 31', () => {
    const feb = advanceNextRunDate(new Date('2026-01-31T00:00:00Z'), 'monthly')
    const mar = advanceNextRunDate(feb, 'monthly')
    expect(mar.toISOString().slice(0, 10)).toBe('2026-03-28')
  })

  it('rolls over the year for a December anchor', () => {
    const next = advanceNextRunDate(new Date('2026-12-31T00:00:00Z'), 'monthly')
    expect(next.toISOString().slice(0, 10)).toBe('2027-01-31')
  })
})
