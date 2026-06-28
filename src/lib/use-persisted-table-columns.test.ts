import { describe, it, expect } from 'vitest'
import { filterColumnsByVisibility } from './use-persisted-table-columns'

describe('filterColumnsByVisibility', () => {
  it('keeps columns in definition order', () => {
    const cols = [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B' },
      { key: 'c', header: 'C' },
    ]
    expect(filterColumnsByVisibility(cols, ['c', 'a'])).toEqual([
      { key: 'a', header: 'A' },
      { key: 'c', header: 'C' },
    ])
  })
})
