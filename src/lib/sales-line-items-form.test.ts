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
    const stock = { v1: { quantity: 5, manage_stock: true, allow_backorder: false } }
    expect(findLineExceedingBranchStock(items, stock)).toBe(0)
  })

  it('ignores products without stock control', () => {
    const items = [{ variant_id: 'v1', quantity: '99' }]
    const stock = { v1: { quantity: 0, manage_stock: false, allow_backorder: false } }
    expect(findLineExceedingBranchStock(items, stock)).toBe(-1)
  })

  it('ignores products with backorder enabled', () => {
    const items = [{ variant_id: 'v1', quantity: '99' }]
    const stock = { v1: { quantity: 0, manage_stock: true, allow_backorder: true } }
    expect(findLineExceedingBranchStock(items, stock)).toBe(-1)
  })

  it('collects partial catalog refs for resolution', async () => {
    const { collectCatalogResolveIds, lineItemsNeedCatalogResolve } = await import('@/lib/sales-line-items-form')
    const items = [
      { product_id: 'p1', variant_id: null, description: 'A' },
      { product_id: null, variant_id: 'v2', description: 'B' },
      { product_id: 'p3', variant_id: 'v3', description: 'C' },
    ]
    expect(lineItemsNeedCatalogResolve(items)).toBe(true)
    expect(collectCatalogResolveIds(items).sort()).toEqual(['p1', 'v2'])
  })

  it('formats stock labels without trailing zeros', () => {
    expect(formatBranchStockLabel(12)).toBe('12')
    expect(formatBranchStockLabel(12.5)).toBe('12.5')
    expect(formatBranchStockLabel(12.5000)).toBe('12.5')
  })
})
