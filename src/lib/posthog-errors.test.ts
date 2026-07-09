import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: vi.fn() }))

import { parsePostHogDistinctId } from './posthog-errors'

describe('posthog-errors', () => {
  it('parsePostHogDistinctId returns distinct_id from PostHog cookie', () => {
    const payload = encodeURIComponent(JSON.stringify({ distinct_id: 'user-abc' }))
    const cookie = `other=1; ph_phc_token_posthog=${payload}; session=xyz`

    expect(parsePostHogDistinctId(cookie)).toBe('user-abc')
  })

  it('parsePostHogDistinctId returns null when cookie is missing or invalid', () => {
    expect(parsePostHogDistinctId('')).toBeNull()
    expect(parsePostHogDistinctId('ph_phc_x_posthog=not-json')).toBeNull()
  })
})
