import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/inventory/stock-item.model', () => ({ default: { sum: vi.fn() } }))
vi.mock('@/modules/inventory/branch-warehouse.resolution', () => ({
  resolveWarehouseForBranch: vi.fn(),
  BranchWarehouseResolutionError: class BranchWarehouseResolutionError extends Error {
    code = 'BRANCH_WAREHOUSE_NOT_CONFIGURED'
  },
}))
vi.mock('./woo-sites.service', () => ({ buildClientForSite: vi.fn() }))
vi.mock('./woo-queue', () => ({ enqueue: vi.fn() }))
vi.mock('./woocommerce-site.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./woocommerce-product-link.model', () => ({ default: { findOne: vi.fn() } }))

import StockItem from '@/modules/inventory/stock-item.model'
import { BranchWarehouseResolutionError, resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import { computeAvailableForSite } from './woo-stock.service'

const site = { id: 's1', org_id: 'o1', branch_id: 'b1', stock_safety_buffer: '3' } as never

beforeEach(() => vi.clearAllMocks())

describe('computeAvailableForSite', () => {
  it('subtracts the safety buffer and floors at a whole unit', async () => {
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh1')
    ;(StockItem.sum as Mock).mockResolvedValue(10.7)
    expect(await computeAvailableForSite(site, 'v1')).toBe(7)
  })

  it('never returns a negative quantity', async () => {
    ;(resolveWarehouseForBranch as Mock).mockResolvedValue('wh1')
    ;(StockItem.sum as Mock).mockResolvedValue(1)
    expect(await computeAvailableForSite(site, 'v1')).toBe(0)
  })

  it('propagates missing branch warehouse configuration', async () => {
    ;(resolveWarehouseForBranch as Mock).mockRejectedValue(
      new BranchWarehouseResolutionError('BRANCH_WAREHOUSE_NOT_CONFIGURED', 'not configured'),
    )
    await expect(computeAvailableForSite(site, 'v1')).rejects.toMatchObject({
      code: 'BRANCH_WAREHOUSE_NOT_CONFIGURED',
    })
  })
})
