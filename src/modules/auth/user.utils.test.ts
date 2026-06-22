import { describe, it, expect } from 'vitest'
import { formatUserDisplayName, splitLegacyUserName } from './user.utils'

describe('user.utils', () => {
  it('formats display name from parts', () => {
    expect(formatUserDisplayName('Ana', 'García')).toBe('Ana García')
    expect(formatUserDisplayName('Ana', '')).toBe('Ana')
  })

  it('splits legacy full name', () => {
    expect(splitLegacyUserName('Ana García')).toEqual({ firstName: 'Ana', lastName: 'García' })
    expect(splitLegacyUserName('Ana')).toEqual({ firstName: 'Ana', lastName: '' })
  })
})
