import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import SubscriptionExtra from './subscription-extra.model'
import SubscriptionMetricAllowance from './subscription-metric-allowance.model'
import BillingPlan from './billing-plan.model'
import BillingPlanExtra from './billing-plan-extra.model'
import Organization from '@/modules/auth/organization.model'
import {
  resolveAddonsForCreate,
  syncSubscriptionContractToOrg,
} from './subscription-contract.service'
import type {
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  SubscriptionQuery,
  SubscriptionAddonInput,
  SubscriptionExtraInput,
  SubscriptionMetricAllowanceInput,
} from './subscription.schema'

const ORG_INCLUDE = {
  model: Organization,
  as: 'organization',
  attributes: ['id', 'name', 'legal_name'],
}

const SUBSCRIPTION_INCLUDE = [
  { model: BillingPlan, as: 'plan' },
  { model: SubscriptionAddon, as: 'addons' },
  { model: SubscriptionExtra, as: 'extras' },
  { model: SubscriptionMetricAllowance, as: 'metric_allowances' },
  ORG_INCLUDE,
]

export async function listSubscriptions(query: SubscriptionQuery) {
  const { page, limit, org_id, status } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (org_id) where.org_id = org_id
  if (status) where.status = status

  const { rows, count } = await OrgSubscription.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: SUBSCRIPTION_INCLUDE,
  })

  return toPaginated(rows, count, page, limit)
}

export async function getSubscription(id: string) {
  const sub = await OrgSubscription.findByPk(id, { include: SUBSCRIPTION_INCLUDE })
  if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')
  return sub
}

export async function createSubscription(input: SubscriptionCreateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const plan = await BillingPlan.findByPk(input.plan_id, { transaction: t })
    if (!plan) throw new Error('PLAN_NOT_FOUND')

    const existing = await OrgSubscription.findOne({
      where: { org_id: input.org_id, status: { [Op.ne]: 'cancelled' } },
      transaction: t,
    })
    if (existing) throw new Error('SUBSCRIPTION_ALREADY_EXISTS')

    const sub = await OrgSubscription.create(
      {
        org_id:      input.org_id,
        plan_id:     input.plan_id,
        seats:       input.seats,
        billing_day: input.billing_day,
        status:      input.status,
        trial_end:   input.trial_end ?? null,
        notes:       input.notes ?? null,
        started_at:  input.status === 'active' ? new Date() : null,
        created_by:  actorId,
        updated_by:  actorId,
      },
      { transaction: t },
    )

    const extras = await resolveExtrasForCreate(input.plan_id, input.extras, t)
    const addons = await resolveAddonsForCreate(input.plan_id, input.addons, t)
    await replaceAddons(sub.id, input.org_id, addons, actorId, t)
    await replaceExtras(sub.id, input.org_id, extras, actorId, t)
    await replaceMetricAllowances(sub.id, input.org_id, input.metric_allowances, actorId, t)
    await syncSubscriptionContractToOrg(input.org_id, input.plan_id, addons, t)

    logger.info({ subscriptionId: sub.id, orgId: input.org_id, planId: input.plan_id, actorId }, 'subscription created')
    return getSubscriptionInTransaction(sub.id, t)
  })
}

export async function updateSubscription(id: string, input: SubscriptionUpdateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const sub = await OrgSubscription.findByPk(id, { transaction: t })
    if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')

    if (input.plan_id && input.plan_id !== sub.plan_id) {
      const plan = await BillingPlan.findByPk(input.plan_id, { transaction: t })
      if (!plan) throw new Error('PLAN_NOT_FOUND')
    }

    const { addons, extras, metric_allowances, ...fields } = input
    const updateData: Record<string, unknown> = { ...fields, updated_by: actorId }

    if (input.status === 'active' && !sub.started_at) updateData.started_at = new Date()
    if (input.status === 'cancelled' && !sub.cancelled_at) updateData.cancelled_at = new Date()

    await sub.update(updateData, { transaction: t })

    if (addons) {
      const planIdForAddons = input.plan_id ?? sub.plan_id
      const resolvedAddons = await resolveAddonsForCreate(planIdForAddons, addons, t)
      await replaceAddons(id, sub.org_id, resolvedAddons, actorId, t)
      await syncSubscriptionContractToOrg(sub.org_id!, planIdForAddons, resolvedAddons, t)
    } else if (input.plan_id && input.plan_id !== sub.plan_id) {
      const currentAddons = await SubscriptionAddon.findAll({ where: { subscription_id: id }, transaction: t })
      const addonInputs = currentAddons.map(a => ({
        module_key: a.module_key,
        unit_price: a.unit_price,
        enabled: a.enabled,
      }))
      await syncSubscriptionContractToOrg(sub.org_id!, input.plan_id, addonInputs, t)
    }
    if (extras) {
      await replaceExtras(id, sub.org_id, extras, actorId, t)
    }
    if (metric_allowances) {
      await replaceMetricAllowances(id, sub.org_id, metric_allowances, actorId, t)
    }

    logger.info({ subscriptionId: id, actorId }, 'subscription updated')
    return getSubscriptionInTransaction(id, t)
  })
}

async function resolveExtrasForCreate(
  planId: string,
  extras: SubscriptionExtraInput[],
  t: import('sequelize').Transaction,
): Promise<SubscriptionExtraInput[]> {
  const planExtras = await BillingPlanExtra.findAll({ where: { plan_id: planId }, transaction: t })
  const byKey = new Map<string, SubscriptionExtraInput>()

  for (const pe of planExtras) {
    if (pe.included) {
      byKey.set(pe.extra_key, { extra_key: pe.extra_key, unit_price: '0.00', enabled: true })
    }
  }
  for (const e of extras) {
    byKey.set(e.extra_key, e)
  }
  return [...byKey.values()]
}

async function replaceAddons(
  subscriptionId: string,
  orgId: string | null,
  addons: SubscriptionAddonInput[],
  actorId: string,
  t: import('sequelize').Transaction,
) {
  await SubscriptionAddon.destroy({ where: { subscription_id: subscriptionId }, transaction: t })
  if (addons.length === 0) return
  await SubscriptionAddon.bulkCreate(
    addons.map(a => ({
      subscription_id: subscriptionId,
      org_id:          orgId,
      module_key:      a.module_key,
      unit_price:      a.unit_price,
      enabled:         a.enabled,
      created_by:      actorId,
      updated_by:      actorId,
    })),
    { transaction: t },
  )
}

async function replaceExtras(
  subscriptionId: string,
  orgId: string | null,
  extras: SubscriptionExtraInput[],
  actorId: string,
  t: import('sequelize').Transaction,
) {
  await SubscriptionExtra.destroy({ where: { subscription_id: subscriptionId }, transaction: t })
  if (extras.length === 0) return
  await SubscriptionExtra.bulkCreate(
    extras.map(e => ({
      subscription_id: subscriptionId,
      org_id:          orgId,
      extra_key:       e.extra_key,
      unit_price:      e.unit_price,
      enabled:         e.enabled,
      created_by:      actorId,
      updated_by:      actorId,
    })),
    { transaction: t },
  )
}

async function replaceMetricAllowances(
  subscriptionId: string,
  orgId: string | null,
  allowances: SubscriptionMetricAllowanceInput[],
  actorId: string,
  t: import('sequelize').Transaction,
) {
  await SubscriptionMetricAllowance.destroy({ where: { subscription_id: subscriptionId }, transaction: t })
  const rows = allowances.filter(a => Number(a.extra_included_quantity) > 0)
  if (rows.length === 0) return
  await SubscriptionMetricAllowance.bulkCreate(
    rows.map(a => ({
      subscription_id:         subscriptionId,
      org_id:                  orgId,
      metric_key:              a.metric_key,
      extra_included_quantity: a.extra_included_quantity,
      created_by:              actorId,
      updated_by:              actorId,
    })),
    { transaction: t },
  )
}

async function getSubscriptionInTransaction(id: string, t: import('sequelize').Transaction) {
  return OrgSubscription.findByPk(id, { include: SUBSCRIPTION_INCLUDE, transaction: t })
}
