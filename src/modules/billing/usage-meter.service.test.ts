import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./usage-record.model', () => ({ default: { findOne: vi.fn(), create: vi.fn() } }))
vi.mock('./billing-metric.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('./org-billing.service', () => ({ getOrgSubscription: vi.fn() }))

import UsageRecord from './usage-record.model'
import BillingMetric from './billing-metric.model'
import { getOrgSubscription } from './org-billing.service'
import { upsertMeteredUsage } from './usage-meter.service'

const base = { orgId: 'org-1', metricKey: 'storage_gb', quantity: '4.5000', sourceId: 'storage:2026-06-01' }

beforeEach(() => {
  vi.clearAllMocks()
  ;(BillingMetric.findOne as Mock).mockResolvedValue({ key: 'storage_gb', is_active: true })
  ;(getOrgSubscription as Mock).mockResolvedValue({ id: 'sub-1' })
})

describe('upsertMeteredUsage', () => {
  it('throws without a stable sourceId', async () => {
    await expect(upsertMeteredUsage({ orgId: 'org-1', metricKey: 'storage_gb', quantity: 1 })).rejects.toThrow(/sourceId/)
  })

  it('creates a row when none exists for the period', async () => {
    ;(UsageRecord.findOne as Mock).mockResolvedValue(null)
    ;(UsageRecord.create as Mock).mockResolvedValue({ id: 'u1' })

    await upsertMeteredUsage(base)

    expect(UsageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: 'sub-1',
        metric_key: 'storage_gb',
        quantity: '4.5000',
        source_id: 'storage:2026-06-01',
      }),
    )
  })

  it('updates the quantity when an un-invoiced row exists', async () => {
    const existing = { invoiced_at: null, update: vi.fn().mockResolvedValue(undefined) }
    ;(UsageRecord.findOne as Mock).mockResolvedValue(existing)

    await upsertMeteredUsage({ ...base, quantity: '9.0000' })

    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ quantity: '9.0000' }))
    expect(UsageRecord.create).not.toHaveBeenCalled()
  })

  it('does not touch an already-invoiced row (no re-billing)', async () => {
    const existing = { invoiced_at: new Date(), update: vi.fn() }
    ;(UsageRecord.findOne as Mock).mockResolvedValue(existing)

    const result = await upsertMeteredUsage(base)

    expect(existing.update).not.toHaveBeenCalled()
    expect(result).toBe(existing)
  })

  it('skips when the metric is missing/inactive', async () => {
    ;(BillingMetric.findOne as Mock).mockResolvedValue(null)
    expect(await upsertMeteredUsage(base)).toBeNull()
    expect(UsageRecord.create).not.toHaveBeenCalled()
  })

  it('skips when the org has no active subscription', async () => {
    ;(getOrgSubscription as Mock).mockResolvedValue(null)
    expect(await upsertMeteredUsage(base)).toBeNull()
  })
})
