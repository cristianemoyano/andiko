import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})) },
}))

import { computeBomRollupCost } from './production.utils'

describe('computeBomRollupCost', () => {
  it('sums quantity × cost_price across components, prorated by output_quantity', () => {
    const cost = computeBomRollupCost(
      [
        { quantity: '2', scrap_pct: '0', cost_price: '10.00' },
        { quantity: '1', scrap_pct: '0', cost_price: '5.00' },
      ],
      '1',
    )
    // (2 * 10) + (1 * 5) = 25, output_quantity 1 → 25 per unit
    expect(cost.toFixed(2)).toBe('25.00')
  })

  it('applies scrap_pct as an extra fraction of the component consumed', () => {
    const cost = computeBomRollupCost(
      [{ quantity: '10', scrap_pct: '10', cost_price: '1.00' }],
      '1',
    )
    // 10 * (1 + 0.10) * 1.00 = 11
    expect(cost.toFixed(2)).toBe('11.00')
  })

  it('prorates the total cost by output_quantity for batch-yield recipes', () => {
    const cost = computeBomRollupCost(
      [{ quantity: '20', scrap_pct: '0', cost_price: '2.00' }],
      '10',
    )
    // total 40, yields 10 units → 4 per unit
    expect(cost.toFixed(2)).toBe('4.00')
  })

  it('treats components with no cost_price loaded as zero cost', () => {
    const cost = computeBomRollupCost(
      [{ quantity: '5', scrap_pct: '0', cost_price: null }],
      '1',
    )
    expect(cost.toFixed(2)).toBe('0.00')
  })

  it('returns the raw total (no division) when output_quantity is zero or negative', () => {
    const cost = computeBomRollupCost(
      [{ quantity: '5', scrap_pct: '0', cost_price: '2.00' }],
      '0',
    )
    expect(cost.toFixed(2)).toBe('10.00')
  })
})
