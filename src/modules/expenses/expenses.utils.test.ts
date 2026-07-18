import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ default: {} }))

import {
  calcExpenseDocumentTotals,
  calcExpenseLine,
  calcExpenseTotals,
  calcExpenseTotalsFromGross,
  advanceNextRunDate,
  buildInstallmentSchedule,
} from './expenses.utils'

describe('expense line totals', () => {
  it('calculates quantity, discount and IVA per line', () => {
    expect(calcExpenseLine('2', '100.00', '10', '21')).toEqual({
      subtotal: '200.00',
      discount_amount: '20.00',
      tax_base: '180.00',
      tax_amount: '37.80',
      total: '217.80',
    })
  })

  it('aggregates lines with different IVA rates without floating-point drift', () => {
    const totals = calcExpenseDocumentTotals([
      calcExpenseLine('1', '100.00', '0', '21'),
      calcExpenseLine('1', '50.00', '0', '10.5'),
    ])
    expect(totals).toEqual({
      subtotal: '150.00',
      discount_amount: '0.00',
      tax_amount: '26.25',
      total: '176.25',
    })
  })
})

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

  it('advances by two calendar months for "bimonthly"', () => {
    const next = advanceNextRunDate(new Date('2026-07-13T00:00:00Z'), 'bimonthly')
    expect(next.toISOString().slice(0, 10)).toBe('2026-09-13')
  })

  it('clamps a day-31 anchor when advancing bimonthly', () => {
    const next = advanceNextRunDate(new Date('2026-01-31T00:00:00Z'), 'bimonthly')
    expect(next.toISOString().slice(0, 10)).toBe('2026-03-31')
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

describe('calcExpenseTotalsFromGross', () => {
  it('reverses IVA from a payable total', () => {
    const totals = calcExpenseTotalsFromGross('121.00', '0.00', '21')
    expect(totals.total).toBe('121.00')
    expect(totals.subtotal).toBe('100.00')
    expect(totals.tax_amount).toBe('21.00')
  })
})

describe('buildInstallmentSchedule', () => {
  it('splits a total into equal cuotas with cent adjustment on the last', () => {
    const rows = buildInstallmentSchedule({
      count: 3,
      firstDueDate: new Date('2026-07-01T00:00:00Z'),
      frequency: 'monthly',
      total: '100.00',
    })
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.amount)).toEqual(['33.33', '33.33', '33.34'])
    expect(rows[0]!.due_date.toISOString().slice(0, 10)).toBe('2026-07-01')
    expect(rows[1]!.due_date.toISOString().slice(0, 10)).toBe('2026-08-01')
    expect(rows[2]!.due_date.toISOString().slice(0, 10)).toBe('2026-09-01')
  })
})
