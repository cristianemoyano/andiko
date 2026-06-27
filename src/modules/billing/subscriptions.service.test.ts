import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./org-subscription.model', () => ({ default: { findByPk: vi.fn(), findOne: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./subscription-addon.model', () => ({ default: { destroy: vi.fn(), bulkCreate: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./subscription-extra.model', () => ({ default: { destroy: vi.fn(), bulkCreate: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./subscription-metric-allowance.model', () => ({ default: { destroy: vi.fn(), bulkCreate: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-plan-extra.model', () => ({ default: { findAll: vi.fn().mockResolvedValue([]), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-plan-module.model', () => ({ default: { findAll: vi.fn().mockResolvedValue([]), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-plan.model', () => ({ default: { findByPk: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./subscription-contract.service', () => ({
  resolveAddonsForCreate: vi.fn(async (_planId, addons) => addons),
  syncSubscriptionContractToOrg: vi.fn(),
}))
vi.mock('@/modules/auth/organization.model', () => ({ default: { belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb) => cb({ lock: true })) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))

import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import BillingPlan from './billing-plan.model'
import { createSubscription, updateSubscription } from './subscriptions.service'

beforeEach(() => vi.clearAllMocks())

const baseInput = {
  org_id: '11111111-1111-1111-1111-111111111111',
  plan_id: '22222222-2222-2222-2222-222222222222',
  seats: 5,
  billing_day: 1,
  status: 'active' as const,
  addons: [{ module_key: 'inventory' as const, unit_price: '2000.00', enabled: true }],
  extras: [],
  metric_allowances: [],
}

describe('createSubscription', () => {
  it('creates a subscription with snapshot addons when org has none', async () => {
    ;(BillingPlan.findByPk as Mock).mockResolvedValue({ id: baseInput.plan_id })
    ;(OrgSubscription.findOne as Mock).mockResolvedValue(null)
    ;(OrgSubscription.create as Mock).mockResolvedValue({ id: 'sub-1' })
    ;(OrgSubscription.findByPk as Mock).mockResolvedValue({ id: 'sub-1' })

    await createSubscription(baseInput, 'actor-1')

    expect(OrgSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: baseInput.org_id, plan_id: baseInput.plan_id, seats: 5, status: 'active' }),
      expect.anything(),
    )
    expect(SubscriptionAddon.bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ subscription_id: 'sub-1', module_key: 'inventory', unit_price: '2000.00' })],
      expect.anything(),
    )
  })

  it('rejects a second active subscription for the same org', async () => {
    ;(BillingPlan.findByPk as Mock).mockResolvedValue({ id: baseInput.plan_id })
    ;(OrgSubscription.findOne as Mock).mockResolvedValue({ id: 'existing' })

    await expect(createSubscription(baseInput, 'a')).rejects.toThrow('SUBSCRIPTION_ALREADY_EXISTS')
  })

  it('rejects an unknown plan', async () => {
    ;(BillingPlan.findByPk as Mock).mockResolvedValue(null)
    await expect(createSubscription(baseInput, 'a')).rejects.toThrow('PLAN_NOT_FOUND')
  })
})

describe('updateSubscription', () => {
  it('stamps cancelled_at when transitioning to cancelled', async () => {
    const sub = { id: 'sub-1', org_id: baseInput.org_id, plan_id: baseInput.plan_id, started_at: new Date(), cancelled_at: null, update: vi.fn().mockResolvedValue(undefined) }
    ;(OrgSubscription.findByPk as Mock).mockResolvedValue(sub)

    await updateSubscription('sub-1', { status: 'cancelled' }, 'actor-1')

    expect(sub.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', cancelled_at: expect.any(Date), updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('replaces addons when provided', async () => {
    const sub = { id: 'sub-1', org_id: baseInput.org_id, plan_id: baseInput.plan_id, started_at: new Date(), cancelled_at: null, update: vi.fn().mockResolvedValue(undefined) }
    ;(OrgSubscription.findByPk as Mock).mockResolvedValue(sub)

    await updateSubscription('sub-1', { addons: [] }, 'actor-1')

    expect(SubscriptionAddon.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { subscription_id: 'sub-1' } }))
  })
})
