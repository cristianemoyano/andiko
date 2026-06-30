import { describe, it, expect } from 'vitest'
import { isMissingBasePrice } from './product.utils'

/** Mirrors fill candidate partitioning in price-list.service (pure logic). */
function partitionFillCandidates(
  variants: Array<{ id: string; base_price: string | null }>,
  existingVariantIds: Set<string>,
  includeWithoutPrice: boolean,
) {
  const candidates = variants.filter((v) => !existingVariantIds.has(v.id))
  const withoutPrice = candidates.filter((v) => isMissingBasePrice(v.base_price))
  const withPrice = candidates.filter((v) => !isMissingBasePrice(v.base_price))
  const toAdd = withPrice.length + (includeWithoutPrice ? withoutPrice.length : 0)
  const skipped_no_price = includeWithoutPrice ? 0 : withoutPrice.length
  const skipped_existing = variants.filter((v) => existingVariantIds.has(v.id)).length
  return { added: toAdd, skipped_existing, skipped_no_price }
}

describe('fillPriceListFromCatalog partitioning', () => {
  it('adds only variants with base_price when include_without_price is false', () => {
    const result = partitionFillCandidates(
      [
        { id: 'v1', base_price: '100.00' },
        { id: 'v2', base_price: '200.00' },
        { id: 'v3', base_price: null },
        { id: 'v4', base_price: '' },
      ],
      new Set(['v2']),
      false,
    )
    expect(result).toEqual({ added: 1, skipped_existing: 1, skipped_no_price: 2 })
  })

  it('includes variants without base_price at $0 when opted in', () => {
    const result = partitionFillCandidates(
      [
        { id: 'v1', base_price: '100.00' },
        { id: 'v2', base_price: null },
      ],
      new Set(),
      true,
    )
    expect(result).toEqual({ added: 2, skipped_existing: 0, skipped_no_price: 0 })
  })
})
