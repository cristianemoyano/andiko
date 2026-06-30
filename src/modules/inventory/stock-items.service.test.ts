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
    findOne:         vi.fn(),
    update:          vi.fn(),
  },
}))

vi.mock('./warehouses.service', () => ({
  getWarehouse: vi.fn(),
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('./stock-item-batch.model', () => ({
  default: { findOrCreate: vi.fn(), findAll: vi.fn() },
}))

vi.mock('./stock-batches.service', () => ({
  earliestExpiry:              vi.fn(),
  ensureBatchesMatchAggregate: vi.fn(),
}))

import StockItem from './stock-item.model'
import StockItemBatch from './stock-item-batch.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { getWarehouse } from './warehouses.service'
import { earliestExpiry, ensureBatchesMatchAggregate } from './stock-batches.service'
import { getStockLevels, updateStockItemAlerts, bulkSetStockMinimum, bulkSetStockExpiry, applyWarehouseDefaultMinimum } from './stock-items.service'

beforeEach(() => {
  vi.clearAllMocks()
  ;(ensureBatchesMatchAggregate as Mock).mockResolvedValue(undefined)
})

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
      { id: 'item-1', update, quantity: '5.0000', minimum_quantity: '0', expires_on: null },
      false,
    ])
    const batchUpdate = vi.fn().mockResolvedValue(undefined)
    ;(StockItemBatch.findOrCreate as Mock).mockResolvedValue([
      { id: 'batch-default', update: batchUpdate, expiry_date: null },
      false,
    ])
    // expires_on is derived from the earliest live batch after the default batch is set.
    ;(earliestExpiry as Mock).mockResolvedValue('2026-05-01')

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

    // The chosen expiry is written onto the legacy/default batch...
    expect(batchUpdate).toHaveBeenCalledWith(
      { expiry_date: '2026-05-01' },
      expect.anything(),
    )
    // ...and the aggregate's expires_on uses the explicit date set by the user.
    expect(update).toHaveBeenCalledWith({ expires_on: '2026-05-01' }, expect.anything())
    expect(update).toHaveBeenCalledWith({ minimum_quantity: '12.5000' }, expect.anything())
  })
})

describe('bulkSetStockMinimum', () => {
  it('updates minimum for each existing stock item', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1' })
    const update = vi.fn().mockResolvedValue(undefined)
    ;(StockItem.findOne as Mock).mockResolvedValue({ update, quantity: '5' })

    const result = await bulkSetStockMinimum(
      { orgId: 'org-1', userId: 'u1', defaultBranchId: 'br-1', allowedBranchIds: ['br-1'] },
      {
        items: [{ variant_id: 'var-1', warehouse_id: 'wh-1' }],
        minimum_quantity: 10,
      },
    )

    expect(result.updated).toBe(1)
    expect(update).toHaveBeenCalledWith({ minimum_quantity: '10.0000' }, expect.anything())
  })
})

describe('bulkSetStockExpiry', () => {
  it('updates default batch expiry and syncs expires_on', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1' })
    const itemUpdate = vi.fn().mockResolvedValue(undefined)
    const batchUpdate = vi.fn().mockResolvedValue(undefined)
    ;(StockItem.findOne as Mock).mockResolvedValue({ id: 'item-1', quantity: '150', update: itemUpdate })
    ;(StockItemBatch.findOrCreate as Mock).mockResolvedValue([
      { update: batchUpdate },
      false,
    ])
    ;(earliestExpiry as Mock).mockResolvedValue('2026-01-01')

    const result = await bulkSetStockExpiry(
      { orgId: 'org-1', userId: 'u1', defaultBranchId: 'br-1', allowedBranchIds: ['br-1'] },
      {
        items: [{ variant_id: 'var-1', warehouse_id: 'wh-1' }],
        expires_on: '2026-08-15',
      },
    )

    expect(result.updated).toBe(1)
    expect(ensureBatchesMatchAggregate).toHaveBeenCalled()
    expect(batchUpdate).toHaveBeenCalledWith({ expiry_date: '2026-08-15' }, expect.anything())
    expect(itemUpdate).toHaveBeenCalledWith({ expires_on: '2026-08-15' }, expect.anything())
  })

  it('derives expires_on from earliest batch when clearing expiry', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1' })
    const itemUpdate = vi.fn().mockResolvedValue(undefined)
    const batchUpdate = vi.fn().mockResolvedValue(undefined)
    ;(StockItem.findOne as Mock).mockResolvedValue({ id: 'item-1', quantity: '10', update: itemUpdate })
    ;(StockItemBatch.findOrCreate as Mock).mockResolvedValue([{ update: batchUpdate }, false])
    ;(earliestExpiry as Mock).mockResolvedValue('2026-03-01')

    await bulkSetStockExpiry(
      { orgId: 'org-1', userId: 'u1', defaultBranchId: 'br-1', allowedBranchIds: ['br-1'] },
      {
        items: [{ variant_id: 'var-1', warehouse_id: 'wh-1' }],
        expires_on: null,
      },
    )

    expect(itemUpdate).toHaveBeenCalledWith({ expires_on: '2026-03-01' }, expect.anything())
  })
})

describe('applyWarehouseDefaultMinimum', () => {
  it('skips when warehouse default is zero', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1', default_minimum_quantity: '0' })

    const result = await applyWarehouseDefaultMinimum(
      { orgId: 'org-1', userId: 'u1', defaultBranchId: 'br-1', allowedBranchIds: ['br-1'] },
      'wh-1',
      { only_without_minimum: true },
    )

    expect(result.updated).toBe(0)
    expect(StockItem.update).not.toHaveBeenCalled()
  })

  it('bulk updates stock items with warehouse default', async () => {
    ;(getWarehouse as Mock).mockResolvedValue({ branch_id: 'br-1', default_minimum_quantity: '5' })
    ;(StockItem.update as Mock).mockResolvedValue([3])

    const result = await applyWarehouseDefaultMinimum(
      { orgId: 'org-1', userId: 'u1', defaultBranchId: 'br-1', allowedBranchIds: ['br-1'] },
      'wh-1',
      { only_without_minimum: true },
    )

    expect(result.updated).toBe(3)
    expect(StockItem.update).toHaveBeenCalledWith(
      { minimum_quantity: '5.0000' },
      expect.objectContaining({ where: expect.any(Object) }),
    )
  })
})
