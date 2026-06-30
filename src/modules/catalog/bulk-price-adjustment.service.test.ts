import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import type { BulkPriceAdjustmentInput } from './bulk-price-adjustment.schema'

// Test the pure math logic extracted inline for unit testing
function applyAdjustment(current: string, input: Pick<BulkPriceAdjustmentInput, 'adjustment_type' | 'value'>): string {
  const price = new Decimal(current)
  const val = new Decimal(input.value)

  switch (input.adjustment_type) {
    case 'percent_increase':
      return price.mul(new Decimal(1).add(val.div(100))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'percent_decrease':
      return price.mul(new Decimal(1).sub(val.div(100))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'fixed_increase':
      return price.add(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'fixed_decrease':
      return Decimal.max(0, price.sub(val)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'set':
      return val.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    default:
      return price.toFixed(2)
  }
}

describe('bulk-price-adjustment math', () => {
  it('applies percent increase', () => {
    expect(applyAdjustment('100.00', { adjustment_type: 'percent_increase', value: '10' })).toBe('110.00')
  })

  it('applies percent decrease', () => {
    expect(applyAdjustment('200.00', { adjustment_type: 'percent_decrease', value: '25' })).toBe('150.00')
  })

  it('applies fixed increase', () => {
    expect(applyAdjustment('50.00', { adjustment_type: 'fixed_increase', value: '12.50' })).toBe('62.50')
  })

  it('applies fixed decrease without going negative', () => {
    expect(applyAdjustment('10.00', { adjustment_type: 'fixed_decrease', value: '15' })).toBe('0.00')
  })

  it('sets absolute price', () => {
    expect(applyAdjustment('999.99', { adjustment_type: 'set', value: '1500.00' })).toBe('1500.00')
  })

  it('rounds half-up to 2 decimals', () => {
    expect(applyAdjustment('10.00', { adjustment_type: 'percent_increase', value: '33.333' })).toBe('13.33')
  })

  it('applies percent increase from zero', () => {
    expect(applyAdjustment('0.00', { adjustment_type: 'percent_increase', value: '10' })).toBe('0.00')
  })

  it('applies fixed increase from zero', () => {
    expect(applyAdjustment('0.00', { adjustment_type: 'fixed_increase', value: '100' })).toBe('100.00')
  })
})
