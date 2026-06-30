import { describe, it, expect } from 'vitest'
import {
  findLineExceedingBranchStock,
  formatBranchStockLabel,
} from '@/lib/sales-line-items-form'

describe('sales-line-items-form stock helpers', () => {
  it('flags the first line when cumulative demand exceeds stock', () => {
    const items = [
      { variant_id: 'v1', quantity: '3' },
      { variant_id: 'v1', quantity: '3' },
    ]
    const stock = { v1: { quantity: 5, manage_stock: true } }
    expect(findLineExceedingBranchStock(items, stock)).toBe(0)
  })

  it('ignores products without stock control', () => {
    const items = [{ variant_id: 'v1', quantity: '99' }]
    const stock = { v1: { quantity: 0, manage_stock: false } }
    expect(findLineExceedingBranchStock(items, stock)).toBe(-1)
  })

  it('formats stock labels without trailing zeros', () => {
    expect(formatBranchStockLabel(12)).toBe('12')
    expect(formatBranchStockLabel(12.5)).toBe('12.5')
    expect(formatBranchStockLabel(12.5000)).toBe('12.5')
  })
})
