import { describe, expect, it } from 'vitest'
import { paginate } from '@/lib/pagination'

describe('import preview pagination', () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ sku: `SKU-${i}`, name: `Product ${i}` }))

  it('returns a single page slice for the requested section', () => {
    const page = 2
    const limit = 20
    const { offset } = paginate(page, limit)
    const slice = items.slice(offset, offset + limit)
    expect(slice).toHaveLength(20)
    expect(slice[0]?.sku).toBe('SKU-20')
    expect(Math.ceil(items.length / limit)).toBe(3)
  })
})
