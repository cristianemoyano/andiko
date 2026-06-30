import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/modules/catalog/product.model', () => ({
  default: {},
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findAll: vi.fn(), findAndCountAll: vi.fn(), count: vi.fn() },
}))

vi.mock('./stock-item.model', () => ({
  default: { findAll: vi.fn(), findOrCreate: vi.fn(), bulkCreate: vi.fn() },
}))

vi.mock('./stock-movements.service', () => ({
  applyMovement: vi.fn(),
}))

vi.mock('./warehouses.service', () => ({
  getWarehouse: vi.fn(),
}))

vi.mock('./stock-items.service', () => ({
  resolveDefaultMinimumForWarehouse: vi.fn().mockResolvedValue('0'),
}))

vi.mock('@/lib/db', () => ({
  default: {
    escape: (v: string) => `'${v}'`,
    transaction: vi.fn((fn: (t: unknown) => Promise<void>) => fn({})),
    query: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from './stock-item.model'
import { applyMovement } from './stock-movements.service'
import { getWarehouse } from './warehouses.service'
import { bulkLoadCatalogStockForFilter, loadCatalogStockBatch } from './warehouse-catalog-stock.service'

const ctx = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: 'br-1',
  allowedBranchIds: ['br-1'] as string[],
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getWarehouse as Mock).mockResolvedValue({ id: 'wh-1', branch_id: 'br-1' })
  ;(ProductVariant.findAll as Mock).mockResolvedValue([{ id: 'var-1', sku: 'SKU-1' }])
  ;(ProductVariant.count as Mock).mockResolvedValue(1)
  ;(StockItem.findAll as Mock).mockResolvedValue([])
  ;(StockItem.bulkCreate as Mock).mockResolvedValue([])
  ;(StockItem.findOrCreate as Mock).mockImplementation(async ({ where }) => [
    { id: 'si-1', variant_id: where.variant_id, warehouse_id: where.warehouse_id, quantity: '0' },
  ])
  ;(applyMovement as Mock).mockResolvedValue(undefined)
})

describe('bulkLoadCatalogStockForFilter', () => {
  it('loads quantity for filter matches without existing stock', async () => {
    ;(StockItem.findAll as Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'si-1', variant_id: 'var-1', quantity: '0' }])

    const onProgress = vi.fn()
    const result = await bulkLoadCatalogStockForFilter(
      'wh-1',
      { quantity: 5, only_not_in_warehouse: true },
      ctx,
      'actor-1',
      onProgress,
    )

    expect(result.total).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(onProgress).toHaveBeenCalled()
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: 'var-1',
        quantityDelta: new Decimal(5),
      }),
      expect.anything(),
    )
  })

  it('skips variants that already have stock in the warehouse', async () => {
    ;(StockItem.findAll as Mock).mockResolvedValue([{ id: 'si-1', variant_id: 'var-1', quantity: '12' }])

    const result = await bulkLoadCatalogStockForFilter(
      'wh-1',
      { quantity: 5, only_not_in_warehouse: false },
      ctx,
      'actor-1',
    )

    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('stops when the request is aborted between batches', async () => {
    const abortController = new AbortController()
    abortController.abort()

    await expect(
      bulkLoadCatalogStockForFilter(
        'wh-1',
        { quantity: 5, only_not_in_warehouse: true },
        ctx,
        'actor-1',
        undefined,
        abortController.signal,
      ),
    ).rejects.toMatchObject({
      message: 'BULK_LOAD_CANCELLED',
      result: expect.objectContaining({ cancelled: true }),
    })
  })
})

describe('loadCatalogStockBatch', () => {
  it('applies movement for catalog variant quantity', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([{ id: 'var-1' }])

    const result = await loadCatalogStockBatch(
      'wh-1',
      { items: [{ variant_id: 'var-1', quantity: 12 }] },
      ctx,
      'actor-1',
    )

    expect(result.updated).toBe(1)
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: 'var-1',
        warehouseId: 'wh-1',
        quantityDelta: new Decimal(12),
        referenceType: 'initial',
        notes: 'Carga masiva desde catálogo',
      }),
      expect.anything(),
    )
  })
})
