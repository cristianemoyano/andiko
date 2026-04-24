import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: {
    transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})),
  },
}))

vi.mock('./warehouse.model', () => ({
  default: class Warehouse {},
}))

vi.mock('@/modules/catalog/product.model', () => ({
  default: class Product {},
}))

vi.mock('./stock-item.model', () => ({
  default: {
    findAndCountAll: vi.fn(),
    findOrCreate:    vi.fn(),
  },
}))

vi.mock('./warehouses.service', () => ({
  getWarehouse: vi.fn(),
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findOne: vi.fn() },
}))

import StockItem from './stock-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { getWarehouse } from './warehouses.service'
import { getStockLevels, updateStockItemAlerts } from './stock-items.service'

beforeEach(() => vi.clearAllMocks())

describe('getStockLevels', () => {
  it('queries stock with alert filters', async () => {
    ;(StockItem.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 })

    await getStockLevels(
      { page: 1, limit: 20, below_minimum: true, expired: true, expiring_within_days: 14 },
      'org-1',
    )

    expect(StockItem.findAndCountAll).toHaveBeenCalled()
    const arg = (StockItem.findAndCountAll as Mock).mock.calls[0][0]
    expect(arg.where).toBeDefined()
    expect(arg.limit).toBe(20)
  })
})

describe('updateStockItemAlerts', () => {
  it('finds or creates stock item and updates minimum + expiry', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1' })
    ;(ProductVariant.findOne as Mock).mockResolvedValue({ id: 'var-1' })
    const update = vi.fn().mockResolvedValue(undefined)
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([
      { update, quantity: '5.0000', minimum_quantity: '0', expires_on: null },
      false,
    ])

    await updateStockItemAlerts(
      {
        orgId:            'org-1',
        userId:           'u1',
        defaultBranchId:  'br-1',
        allowedBranchIds: ['br-1'],
      },
      {
        variant_id:       'var-1',
        warehouse_id:     'wh-1',
        minimum_quantity: 12.5,
        expires_on:       '2026-05-01',
      },
    )

    expect(update).toHaveBeenCalledWith(
      { minimum_quantity: '12.5000', expires_on: '2026-05-01' },
      expect.anything(),
    )
  })
})
