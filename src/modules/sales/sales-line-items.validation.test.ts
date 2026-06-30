import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/catalog/product.model', () => ({
  default: {},
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findAll: vi.fn() },
}))

import ProductVariant from '@/modules/catalog/product-variant.model'
import {
  SaleLineItemValidationError,
  assertSaleLineItemsFromActiveCatalog,
} from './sales-line-items.validation'

const productId = '4a91f463-89d9-4315-ad56-58a778806ec2'
const variantId = 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assertSaleLineItemsFromActiveCatalog', () => {
  it('rejects lines without product_id or variant_id', async () => {
    await expect(
      assertSaleLineItemsFromActiveCatalog(
        [{ product_id: null, variant_id: null }],
        'org-1',
      ),
    ).rejects.toMatchObject({
      code: 'SALE_LINE_PRODUCT_REQUIRED',
      line: 1,
    })
  })

  it('rejects inactive or missing catalog variants', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([])
    await expect(
      assertSaleLineItemsFromActiveCatalog(
        [{ product_id: productId, variant_id: variantId }],
        'org-1',
      ),
    ).rejects.toMatchObject({
      code: 'SALE_LINE_PRODUCT_NOT_SALEABLE',
      line: 1,
    })
  })

  it('rejects product_id that does not match the variant', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, product_id: 'other-product-id' },
    ])
    await expect(
      assertSaleLineItemsFromActiveCatalog(
        [{ product_id: productId, variant_id: variantId }],
        'org-1',
      ),
    ).rejects.toMatchObject({
      code: 'SALE_LINE_PRODUCT_MISMATCH',
      line: 1,
    })
  })

  it('accepts active catalog variants', async () => {
    ;(ProductVariant.findAll as Mock).mockResolvedValue([
      { id: variantId, product_id: productId },
    ])
    await expect(
      assertSaleLineItemsFromActiveCatalog(
        [{ product_id: productId, variant_id: variantId }],
        'org-1',
      ),
    ).resolves.toBeUndefined()
  })

  it('exposes SaleLineItemValidationError name', () => {
    const err = new SaleLineItemValidationError('SALE_LINE_PRODUCT_REQUIRED', 'test', 2)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('SaleLineItemValidationError')
  })
})
