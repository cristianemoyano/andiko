import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/inventory/stock-item.model', () => ({ default: { sum: vi.fn() } }))
vi.mock('@/modules/inventory/warehouses.service', () => ({ resolveDefaultWarehouse: vi.fn() }))
vi.mock('./woo-sites.service', () => ({ buildClientForSite: vi.fn() }))
vi.mock('./woo-queue', () => ({ enqueue: vi.fn() }))
vi.mock('./woocommerce-site.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./woocommerce-product-link.model', () => ({ default: { findOne: vi.fn() } }))

import StockItem from '@/modules/inventory/stock-item.model'
import { resolveDefaultWarehouse } from '@/modules/inventory/warehouses.service'
import { computeAvailableForSite } from './woo-stock.service'

const site = { id: 's1', org_id: 'o1', branch_id: 'b1', stock_safety_buffer: '3' } as never

beforeEach(() => vi.clearAllMocks())

describe('computeAvailableForSite', () => {
  it('subtracts the safety buffer and floors at a whole unit', async () => {
    ;(resolveDefaultWarehouse as Mock).mockResolvedValue('wh1')
    ;(StockItem.sum as Mock).mockResolvedValue(10.7)
    // 10.7 - 3 buffer = 7.7 → floor 7
    expect(await computeAvailableForSite(site, 'v1')).toBe(7)
  })

  it('never returns a negative quantity', async () => {
    ;(resolveDefaultWarehouse as Mock).mockResolvedValue('wh1')
    ;(StockItem.sum as Mock).mockResolvedValue(1)
    // 1 - 3 buffer = -2 → 0
    expect(await computeAvailableForSite(site, 'v1')).toBe(0)
  })

  it('returns 0 when the branch resolves to no warehouse', async () => {
    ;(resolveDefaultWarehouse as Mock).mockResolvedValue(null)
    expect(await computeAvailableForSite(site, 'v1')).toBe(0)
  })
})
