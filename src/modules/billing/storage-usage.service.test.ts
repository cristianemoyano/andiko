import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./org-subscription.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./org-billing.service', () => ({ getOrgSubscription: vi.fn() }))
vi.mock('./billing-counts.service', () => ({ countStorageUsage: vi.fn() }))
vi.mock('./usage-meter.service', () => ({ upsertMeteredUsage: vi.fn() }))
vi.mock('./billing-period.service', () => ({ resolveSubscriptionPeriod: vi.fn() }))

import OrgSubscription from './org-subscription.model'
import { getOrgSubscription } from './org-billing.service'
import { countStorageUsage } from './billing-counts.service'
import { upsertMeteredUsage } from './usage-meter.service'
import { resolveSubscriptionPeriod } from './billing-period.service'
import { meterOrgStorageUsage, runStorageUsageRollup } from './storage-usage.service'

beforeEach(() => {
  vi.clearAllMocks()
  ;(resolveSubscriptionPeriod as Mock).mockReturnValue({
    periodStart: new Date('2026-06-01T00:00:00.000Z'),
    periodEnd: new Date('2026-06-30T23:59:59.999Z'),
  })
})

describe('meterOrgStorageUsage', () => {
  it('snapshots bytes→GB and file count with a period-stable source_id', async () => {
    ;(getOrgSubscription as Mock).mockResolvedValue({ id: 'sub-1', org_id: 'org-1' })
    ;(countStorageUsage as Mock).mockResolvedValue({ bytes: String(2 * 1024 ** 3), files: 7 })

    const result = await meterOrgStorageUsage('org-1', { actorId: 'user-1' })

    expect(result).toMatchObject({ orgId: 'org-1', files: 7, gb: '2' })
    expect(upsertMeteredUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', metricKey: 'storage_gb', quantity: '2', sourceId: 'storage:2026-06-01', actorId: 'user-1' }),
    )
    expect(upsertMeteredUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', metricKey: 'storage_files', quantity: 7, sourceId: 'storage:2026-06-01', actorId: 'user-1' }),
    )
  })

  it('returns null when the org has no active subscription', async () => {
    ;(getOrgSubscription as Mock).mockResolvedValue(null)
    expect(await meterOrgStorageUsage('org-1')).toBeNull()
    expect(upsertMeteredUsage).not.toHaveBeenCalled()
  })
})

describe('runStorageUsageRollup', () => {
  it('snapshots bytes→GB and file count for each org with a period-stable source_id', async () => {
    ;(OrgSubscription.findAll as Mock).mockResolvedValue([{ id: 'sub-1', org_id: 'org-1' }])
    // 2 GiB exactly + 7 files
    ;(countStorageUsage as Mock).mockResolvedValue({ bytes: String(2 * 1024 ** 3), files: 7 })

    const result = await runStorageUsageRollup()

    expect(result.processed).toBe(1)
    expect(result.orgs[0]).toMatchObject({ orgId: 'org-1', files: 7, gb: '2' })

    expect(upsertMeteredUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', metricKey: 'storage_gb', quantity: '2', sourceId: 'storage:2026-06-01' }),
    )
    expect(upsertMeteredUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', metricKey: 'storage_files', quantity: 7, sourceId: 'storage:2026-06-01' }),
    )
  })

  it('rounds GB to 4 decimal places', async () => {
    ;(OrgSubscription.findAll as Mock).mockResolvedValue([{ id: 'sub-1', org_id: 'org-1' }])
    ;(countStorageUsage as Mock).mockResolvedValue({ bytes: '1500000', files: 3 }) // ~0.0013969 GiB

    await runStorageUsageRollup()

    const gbCall = (upsertMeteredUsage as Mock).mock.calls.find((c) => c[0].metricKey === 'storage_gb')
    expect(gbCall?.[0].quantity).toBe('0.0014')
  })

  it('skips subscriptions without an org', async () => {
    ;(OrgSubscription.findAll as Mock).mockResolvedValue([{ id: 'sub-x', org_id: null }])
    const result = await runStorageUsageRollup()
    expect(result.processed).toBe(0)
    expect(upsertMeteredUsage).not.toHaveBeenCalled()
  })
})
