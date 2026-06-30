import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/modules/inventory/stock-item.model', () => ({
  default: { findOrCreate: vi.fn() },
}))

vi.mock('@/modules/inventory/stock-movements.service', () => ({
  applyMovement: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import StockItem from '@/modules/inventory/stock-item.model'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import {
  bindImportStockWarehouse,
  syncImportedStockIfMapped,
  syncImportedStockToWarehouse,
} from './catalog-import-stock'

const makeTx = () => ({} as never)

beforeEach(() => {
  vi.clearAllMocks()
  ;(StockItem.findOrCreate as Mock).mockResolvedValue([{ id: 'si-1', quantity: '0' }])
  ;(applyMovement as Mock).mockResolvedValue(undefined)
})

describe('syncImportedStockIfMapped', () => {
  it('skips when manage_stock is false', async () => {
    const T = makeTx()
    bindImportStockWarehouse(T, 'wh-1')
    await syncImportedStockIfMapped({
      orgId: 'org-1',
      variantId: 'var-1',
      manageStock: false,
      stockQuantity: 10,
      actorId: 'user-1',
      transaction: T,
    })
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('skips when no warehouse was bound for the transaction', async () => {
    const T = makeTx()
    await syncImportedStockIfMapped({
      orgId: 'org-1',
      variantId: 'var-1',
      manageStock: true,
      stockQuantity: 10,
      actorId: 'user-1',
      transaction: T,
    })
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('applies movement when warehouse bound and manage_stock true', async () => {
    const T = makeTx()
    bindImportStockWarehouse(T, 'wh-1')
    await syncImportedStockIfMapped({
      orgId: 'org-1',
      variantId: 'var-1',
      manageStock: true,
      stockQuantity: 12,
      actorId: 'user-1',
      transaction: T,
    })
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: 'var-1',
        warehouseId: 'wh-1',
        quantityDelta: new Decimal(12),
        referenceType: 'initial',
        notes: 'Stock importado desde catálogo CSV',
      }),
      T,
    )
  })

  it('syncs zero quantity when stock column was not mapped', async () => {
    const T = makeTx()
    bindImportStockWarehouse(T, 'wh-1')
    await syncImportedStockIfMapped({
      orgId: 'org-1',
      variantId: 'var-1',
      manageStock: true,
      stockQuantity: undefined,
      actorId: 'user-1',
      transaction: T,
    })
    expect(applyMovement).not.toHaveBeenCalled()
  })
})

describe('syncImportedStockToWarehouse', () => {
  it('does nothing when delta is zero', async () => {
    const T = makeTx()
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([{ id: 'si-1', quantity: '5' }])
    await syncImportedStockToWarehouse('org-1', 'wh-1', 'var-1', 5, 'user-1', T)
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('does not override existing positive stock', async () => {
    const T = makeTx()
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([{ id: 'si-1', quantity: '8' }])
    await syncImportedStockToWarehouse('org-1', 'wh-1', 'var-1', 10, 'user-1', T)
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('loads stock when warehouse row is at zero', async () => {
    const T = makeTx()
    await syncImportedStockToWarehouse('org-1', 'wh-1', 'var-1', 10, 'user-1', T)
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityDelta: new Decimal(10),
      }),
      T,
    )
  })
})
