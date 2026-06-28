import { describe, it, expect } from 'vitest'
import { resolveListSource, WOO_IMPORT_SOURCE, wooOrderStatusListWhere } from './woo-list-filters'

describe('resolveListSource', () => {
  it('returns woocommerce when linked even if import_source is catalog_csv', () => {
    expect(resolveListSource('catalog_csv', true)).toBe(WOO_IMPORT_SOURCE)
  })

  it('returns woocommerce when import_source is woocommerce', () => {
    expect(resolveListSource('woocommerce', false)).toBe(WOO_IMPORT_SOURCE)
  })

  it('returns import_source when not Woo-linked', () => {
    expect(resolveListSource('catalog_csv', false)).toBe('catalog_csv')
    expect(resolveListSource(null, false)).toBeNull()
  })
})

describe('wooOrderStatusListWhere', () => {
  it('builds a subquery filter for known Woo statuses', () => {
    const where = wooOrderStatusListWhere('org-1', 'processing')
    expect(Object.keys(where)).toContain('id')
    const idClause = (where as { id: Record<symbol, unknown> }).id
    expect(Object.getOwnPropertySymbols(idClause).length).toBeGreaterThan(0)
  })

  it('returns empty filter for unknown statuses', () => {
    expect(wooOrderStatusListWhere('org-1', 'invalid')).toEqual({})
  })
})
