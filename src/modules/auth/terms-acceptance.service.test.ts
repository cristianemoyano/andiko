import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindOne = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/modules/auth/terms-acceptance.model', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}))

import { hasAcceptedCurrentTerms, recordTermsAcceptance } from './terms-acceptance.service'
import { CURRENT_TERMS_VERSION } from './terms-of-service'

describe('hasAcceptedCurrentTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when the user has no acceptances', async () => {
    mockFindOne.mockResolvedValue(null)

    const result = await hasAcceptedCurrentTerms('user-without-acceptances')

    expect(result).toBe(false)
  })

  it('returns false when the latest acceptance is for an old version', async () => {
    mockFindOne.mockResolvedValue({ terms_version: '2025-01-01' })

    const result = await hasAcceptedCurrentTerms('user-with-old-acceptance')

    expect(result).toBe(false)
  })

  it('returns true when the latest acceptance matches the current version', async () => {
    mockFindOne.mockResolvedValue({ terms_version: CURRENT_TERMS_VERSION })

    const result = await hasAcceptedCurrentTerms('user-with-current-acceptance')

    expect(result).toBe(true)
  })
})

describe('recordTermsAcceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always creates a new row and never updates an existing one', async () => {
    mockCreate.mockResolvedValue({ id: 'new-row' })

    await recordTermsAcceptance('user-1', { ipAddress: '1.2.3.4', userAgent: 'vitest' })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        terms_version: CURRENT_TERMS_VERSION,
        ip_address: '1.2.3.4',
        user_agent: 'vitest',
      }),
    )
    // Append-only log: no update/upsert method should exist on the mocked model.
    expect((mockCreate.mock.calls[0][0] as { accepted_at?: Date }).accepted_at).toBeInstanceOf(Date)
  })
})
