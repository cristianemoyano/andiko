import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.mock('./price-list.model', () => ({ default: {} }))
vi.mock('./product.model', () => ({ default: {} }))
vi.mock('./price-list-item.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn() },
}))

vi.mock('./product-variant.model', () => ({
  default: { findAll: vi.fn(), findByPk: vi.fn() },
}))

import PriceListItem from './price-list-item.model'
import ProductVariant from './product-variant.model'
import { getEffectivePricesForVariants } from './price-list.service'

const variantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const variantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const listId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEffectivePricesForVariants', () => {
  it('returns base prices when no price list is selected', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantA, base_price: '100.00' },
      { id: variantB, base_price: '200.00' },
    ])

    const prices = await getEffectivePricesForVariants(null, [variantA, variantB], 'org-1')
    expect(prices).toEqual({
      [variantA]: '100.00',
      [variantB]: '200.00',
    })
    expect(PriceListItem.findAll).not.toHaveBeenCalled()
  })

  it('overrides base prices with list items when present', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantA, base_price: '100.00' },
      { id: variantB, base_price: '200.00' },
    ])
    ;(PriceListItem.findAll as Mock).mockResolvedValue([
      { product_variant_id: variantA, price: '90.00' },
    ])

    const prices = await getEffectivePricesForVariants(listId, [variantA, variantB], 'org-1')
    expect(prices).toEqual({
      [variantA]: '90.00',
      [variantB]: '200.00',
    })
  })
})
