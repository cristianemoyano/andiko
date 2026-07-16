import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { Op } from 'sequelize'

// React `cache()` memoizes per request in the server runtime; in tests we make it a
// passthrough so the process-level TTL cache is what's under test.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock('./org-subscription.model', () => ({ default: { findOne: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))

import OrgSubscription from './org-subscription.model'
import { isOrgSuspended, clearSubscriptionAccessCache } from './subscription-access.service'

const ORG_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  clearSubscriptionAccessCache()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isOrgSuspended', () => {
  it('returns true when the latest subscription is past_due', async () => {
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status: 'past_due' })
    expect(await isOrgSuspended(ORG_ID)).toBe(true)
  })

  it.each(['trialing', 'active', 'paused'] as const)('returns false for status %s', async (status) => {
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status })
    expect(await isOrgSuspended(ORG_ID)).toBe(false)
  })

  it('returns false when the org has no subscription', async () => {
    ;(OrgSubscription.findOne as Mock).mockResolvedValue(null)
    expect(await isOrgSuspended(ORG_ID)).toBe(false)
  })

  it('queries the latest non-cancelled subscription for the org', async () => {
    ;(OrgSubscription.findOne as Mock).mockResolvedValue(null)
    await isOrgSuspended(ORG_ID)

    expect(OrgSubscription.findOne).toHaveBeenCalledWith({
      where: { org_id: ORG_ID, status: { [Op.ne]: 'cancelled' } },
      attributes: ['id', 'status'],
      order: [['created_at', 'DESC']],
    })
  })

  it('caches the result per org for 60s', async () => {
    vi.useFakeTimers()
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status: 'past_due' })

    expect(await isOrgSuspended(ORG_ID)).toBe(true)
    expect(await isOrgSuspended(ORG_ID)).toBe(true)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(1)

    // Within the TTL the cached value survives a status change in the DB.
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status: 'active' })
    vi.advanceTimersByTime(59_000)
    expect(await isOrgSuspended(ORG_ID)).toBe(true)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(1)

    // After the TTL expires the fresh status is picked up.
    vi.advanceTimersByTime(2_000)
    expect(await isOrgSuspended(ORG_ID)).toBe(false)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(2)
  })

  it('caches per org id', async () => {
    ;(OrgSubscription.findOne as Mock)
      .mockResolvedValueOnce({ id: 'sub-1', status: 'past_due' })
      .mockResolvedValueOnce({ id: 'sub-2', status: 'active' })

    expect(await isOrgSuspended(ORG_ID)).toBe(true)
    expect(await isOrgSuspended('22222222-2222-2222-2222-222222222222')).toBe(false)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(2)
  })

  it('clearSubscriptionAccessCache forces a fresh lookup', async () => {
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status: 'past_due' })
    await isOrgSuspended(ORG_ID)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(1)

    clearSubscriptionAccessCache()
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'sub-1', status: 'active' })
    expect(await isOrgSuspended(ORG_ID)).toBe(false)
    expect(OrgSubscription.findOne).toHaveBeenCalledTimes(2)
  })
})
