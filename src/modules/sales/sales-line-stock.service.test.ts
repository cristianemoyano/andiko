import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/modules/catalog/product.model', () => ({
  default: {},
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findAll: vi.fn() },
}))

vi.mock('@/modules/inventory/stock-item.model', () => ({
  default: { findAll: vi.fn() },
}))

vi.mock('@/modules/inventory/branch-warehouse.resolution', () => ({
  resolveWarehouseForBranch: vi.fn(),
}))

import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from '@/modules/inventory/stock-item.model'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import {
  SaleLineStockError,
  assertSaleLineItemsHaveBranchStock,
  getBranchVariantStock,
} from './sales-line-stock.service'

const variantId = 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a'
const branchId = 'b1111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBranchVariantStock', () => {
  it('propagates missing branch warehouse configuration', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: true, get: () => ({ product_type: 'product' }) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockRejectedValue(
      Object.assign(new Error('not configured'), { code: 'BRANCH_WAREHOUSE_NOT_CONFIGURED' }),
    )

    await expect(
      getBranchVariantStock(branchId, [variantId], 'org-1'),
    ).rejects.toThrow('not configured')
    expect(StockItem.findAll).not.toHaveBeenCalled()
  })

  it('skips stock control for services', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: true, get: () => ({ product_type: 'service' }) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '5' }])

    const rows = await getBranchVariantStock(branchId, [variantId], 'org-1')
    expect(rows[0]?.manage_stock).toBe(false)
  })
})

describe('assertSaleLineItemsHaveBranchStock', () => {
  it('rejects quantities above available stock', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: true, get: (key: string) => (key === 'product' ? { product_type: 'product' } : undefined) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '2' }])

    await expect(
      assertSaleLineItemsHaveBranchStock(
        [{ variant_id: variantId, quantity: 3 }],
        branchId,
        'org-1',
      ),
    ).rejects.toBeInstanceOf(SaleLineStockError)
  })

  it('aggregates demand across repeated variants', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: true, get: (key: string) => (key === 'product' ? { product_type: 'product' } : undefined) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '5' }])

    await expect(
      assertSaleLineItemsHaveBranchStock(
        [
          { variant_id: variantId, quantity: 3 },
          { variant_id: variantId, quantity: 3 },
        ],
        branchId,
        'org-1',
      ),
    ).rejects.toMatchObject({ line: 1 })
  })

  it('accepts quantities within available stock', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: true, get: (key: string) => (key === 'product' ? { product_type: 'product' } : undefined) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '5' }])

    await expect(
      assertSaleLineItemsHaveBranchStock(
        [{ variant_id: variantId, quantity: 5 }],
        branchId,
        'org-1',
      ),
    ).resolves.toBeUndefined()
  })

  it('ignores variants without stock control', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, manage_stock: false, allow_backorder: false, get: (key: string) => (key === 'product' ? { product_type: 'product' } : undefined) },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '0' }])

    await expect(
      assertSaleLineItemsHaveBranchStock(
        [{ variant_id: variantId, quantity: 99 }],
        branchId,
        'org-1',
      ),
    ).resolves.toBeUndefined()
  })

  it('allows quantities above available stock when backorder is enabled', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      {
        id: variantId,
        manage_stock: true,
        allow_backorder: true,
        get: (key: string) => (key === 'product' ? { product_type: 'product' } : undefined),
      },
    ])
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh-1')
    ;(StockItem.findAll as Mock).mockResolvedValue([{ variant_id: variantId, quantity: '2' }])

    await expect(
      assertSaleLineItemsHaveBranchStock(
        [{ variant_id: variantId, quantity: 10 }],
        branchId,
        'org-1',
      ),
    ).resolves.toBeUndefined()
  })
})

describe('SaleLineStockError', () => {
  it('stores available and requested amounts', () => {
    const err = new SaleLineStockError('test', 2, '1.0000', '3.0000')
    expect(err.code).toBe('SALE_LINE_INSUFFICIENT_STOCK')
    expect(err.line).toBe(2)
    expect(new Decimal(err.available).toNumber()).toBe(1)
    expect(new Decimal(err.requested).toNumber()).toBe(3)
  })
})
