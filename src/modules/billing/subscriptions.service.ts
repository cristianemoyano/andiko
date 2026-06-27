import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import BillingPlan from './billing-plan.model'
import type { SubscriptionCreateInput, SubscriptionUpdateInput, SubscriptionQuery, SubscriptionAddonInput } from './subscription.schema'

const SUBSCRIPTION_INCLUDE = [
  { model: BillingPlan, as: 'plan' },
  { model: SubscriptionAddon, as: 'addons' },
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

    await replaceAddons(sub.id, input.org_id, input.addons, actorId, t)

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

    const { addons, ...fields } = input
    const updateData: Record<string, unknown> = { ...fields, updated_by: actorId }

    if (input.status === 'active' && !sub.started_at) updateData.started_at = new Date()
    if (input.status === 'cancelled' && !sub.cancelled_at) updateData.cancelled_at = new Date()

    await sub.update(updateData, { transaction: t })

    if (addons) {
      await replaceAddons(id, sub.org_id, addons, actorId, t)
    }

    logger.info({ subscriptionId: id, actorId }, 'subscription updated')
    return getSubscriptionInTransaction(id, t)
  })
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

async function getSubscriptionInTransaction(id: string, t: import('sequelize').Transaction) {
  return OrgSubscription.findByPk(id, { include: SUBSCRIPTION_INCLUDE, transaction: t })
}
