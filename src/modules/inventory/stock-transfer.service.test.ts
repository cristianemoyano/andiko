import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('server-only', () => ({}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'transfer-uuid-1'),
}))

vi.mock('@/lib/db', () => ({
  default: {
    transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})),
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./stock-movements.service', () => ({
  applyMovement: vi.fn(),
}))

vi.mock('./warehouses.service', () => ({
  getWarehouse: vi.fn(),
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('./stock-item.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn() },
}))

import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from './stock-item.model'
import { applyMovement } from './stock-movements.service'
import { getWarehouse } from './warehouses.service'
import { transferStock, transferStockBatch } from './stock-transfer.service'

const ctx = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getWarehouse as Mock).mockImplementation(async (id: string) => ({
    id,
    branch_id: 'branch-1',
    is_active: true,
  }))
  ;(ProductVariant.findOne as Mock).mockResolvedValue({ id: 'var-1', manage_stock: true })
  ;(applyMovement as Mock).mockResolvedValue(undefined)
})

describe('transferStock', () => {
  it('writes transfer_out and transfer_in with shared reference', async () => {
    const result = await transferStock({
      variant_id: 'var-1',
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      quantity: 3,
      notes: 'test',
    }, ctx)

    expect(result.transfer_id).toBe('transfer-uuid-1')
    expect(applyMovement).toHaveBeenCalledTimes(2)
    expect(applyMovement).toHaveBeenNthCalledWith(1, expect.objectContaining({
      warehouseId: 'wh-a',
      movementType: 'transfer_out',
      referenceType: 'transfer',
      referenceId: 'transfer-uuid-1',
      quantityDelta: new Decimal(-3),
    }), expect.anything())
    expect(applyMovement).toHaveBeenNthCalledWith(2, expect.objectContaining({
      warehouseId: 'wh-b',
      movementType: 'transfer_in',
      quantityDelta: new Decimal(3),
    }), expect.anything())
  })

  it('rejects variants without stock management', async () => {
    ;(ProductVariant.findOne as Mock).mockResolvedValue({ id: 'var-1', manage_stock: false })
    await expect(transferStock({
      variant_id: 'var-1',
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      quantity: 1,
    }, ctx)).rejects.toThrow('VARIANT_STOCK_NOT_MANAGED')
  })
})

describe('transferStockBatch', () => {
  it('transfers multiple variants in one transaction', async () => {
    ;(StockItem.findOne as Mock).mockResolvedValue({ quantity: '4' })

    const result = await transferStockBatch({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      items: [{ variant_id: 'var-1' }, { variant_id: 'var-2' }],
    }, ctx)

    expect(result.moved_variants).toBe(2)
    expect(applyMovement).toHaveBeenCalledTimes(4)
  })

  it('throws when nothing moved', async () => {
    ;(ProductVariant.findOne as Mock).mockResolvedValue(null)

    await expect(transferStockBatch({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      items: [{ variant_id: 'var-missing' }],
    }, ctx)).rejects.toThrow('TRANSFER_BATCH_EMPTY')
  })

  it('transfers explicit partial quantity', async () => {
    ;(StockItem.findOne as Mock).mockResolvedValue({ quantity: '10' })

    const result = await transferStockBatch({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      items: [{ variant_id: 'var-1', quantity: 3 }],
    }, ctx)

    expect(result.moved_variants).toBe(1)
    expect(applyMovement).toHaveBeenNthCalledWith(1, expect.objectContaining({
      quantityDelta: new Decimal(-3),
    }), expect.anything())
  })

  it('rejects quantity above origin stock', async () => {
    ;(StockItem.findOne as Mock).mockResolvedValue({ quantity: '2' })

    await expect(transferStockBatch({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      items: [{ variant_id: 'var-1', quantity: 5 }],
    }, ctx)).rejects.toThrow('INSUFFICIENT_STOCK')
  })
})
