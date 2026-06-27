import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import BillingPlan from './billing-plan.model'
import BillingPlanModule from './billing-plan-module.model'
import BillingPlanExtra from './billing-plan-extra.model'
import BillingPlanMetricAllowance from './billing-plan-metric-allowance.model'
import type { BillingPlanInput, BillingPlanUpdateInput, BillingPlanQuery } from './billing-plan.schema'

const PLAN_INCLUDE = [
  { model: BillingPlanModule, as: 'modules' },
  { model: BillingPlanExtra, as: 'extras' },
  { model: BillingPlanMetricAllowance, as: 'metric_allowances' },
]

function planMetricRowsToPersist(
  metric_allowances: BillingPlanInput['metric_allowances'],
  planId: string,
  actorId: string,
) {
  return metric_allowances
    .filter(a => Number(a.included_quantity) > 0 || Number(a.unit_price) > 0)
    .map(a => ({
      plan_id:           planId,
      metric_key:        a.metric_key,
      included_quantity: a.included_quantity,
      unit_price:        a.unit_price,
      created_by:        actorId,
      updated_by:        actorId,
    }))
}

export async function listPlans(query: BillingPlanQuery) {
  const { page, limit, search, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (typeof is_active === 'boolean') where.is_active = is_active
  if (search) {
    where[Op.or as unknown as string] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { code: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await BillingPlan.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    include: PLAN_INCLUDE,
  })

  return toPaginated(rows, count, page, limit)
}

export async function getPlan(id: string) {
  const plan = await BillingPlan.findByPk(id, { include: PLAN_INCLUDE })
  if (!plan) throw new Error('PLAN_NOT_FOUND')
  return plan
}

export async function createPlan(input: BillingPlanInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { modules, extras, metric_allowances, description, ...fields } = input
    const plan = await BillingPlan.create(
      {
        ...fields,
        description: description ?? null,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    if (modules.length > 0) {
      await BillingPlanModule.bulkCreate(
        modules.map(m => ({
          plan_id:     plan.id,
          module_key:  m.module_key,
          included:    m.included,
          addon_price: m.addon_price,
          created_by:  actorId,
          updated_by:  actorId,
        })),
        { transaction: t },
      )
    }

    if (extras.length > 0) {
      await BillingPlanExtra.bulkCreate(
        extras.map(e => ({
          plan_id:     plan.id,
          extra_key:   e.extra_key,
          included:    e.included,
          addon_price: e.addon_price,
          created_by:  actorId,
          updated_by:  actorId,
        })),
        { transaction: t },
      )
    }

    if (metric_allowances.length > 0) {
      const rows = planMetricRowsToPersist(metric_allowances, plan.id, actorId)
      if (rows.length > 0) {
        await BillingPlanMetricAllowance.bulkCreate(rows, { transaction: t })
      }
    }

    logger.info({ planId: plan.id, code: plan.code, actorId }, 'billing plan created')
    return getPlanInTransaction(plan.id, t)
  })
}

export async function updatePlan(id: string, input: BillingPlanUpdateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const plan = await BillingPlan.findByPk(id, { transaction: t })
    if (!plan) throw new Error('PLAN_NOT_FOUND')

    const { modules, extras, metric_allowances, ...fields } = input
    await plan.update({ ...fields, updated_by: actorId }, { transaction: t })

    if (modules) {
      await BillingPlanModule.destroy({ where: { plan_id: id }, transaction: t })
      if (modules.length > 0) {
        await BillingPlanModule.bulkCreate(
          modules.map(m => ({
            plan_id:     id,
            module_key:  m.module_key,
            included:    m.included,
            addon_price: m.addon_price,
            created_by:  actorId,
            updated_by:  actorId,
          })),
          { transaction: t },
        )
      }
    }

    if (extras) {
      await BillingPlanExtra.destroy({ where: { plan_id: id }, transaction: t })
      if (extras.length > 0) {
        await BillingPlanExtra.bulkCreate(
          extras.map(e => ({
            plan_id:     id,
            extra_key:   e.extra_key,
            included:    e.included,
            addon_price: e.addon_price,
            created_by:  actorId,
            updated_by:  actorId,
          })),
          { transaction: t },
        )
      }
    }

    if (metric_allowances) {
      await BillingPlanMetricAllowance.destroy({ where: { plan_id: id }, transaction: t })
      const rows = planMetricRowsToPersist(metric_allowances, id, actorId)
      if (rows.length > 0) {
        await BillingPlanMetricAllowance.bulkCreate(rows, { transaction: t })
      }
    }

    logger.info({ planId: id, actorId }, 'billing plan updated')
    return getPlanInTransaction(id, t)
  })
}

export async function deletePlan(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const plan = await BillingPlan.findByPk(id, { transaction: t })
    if (!plan) throw new Error('PLAN_NOT_FOUND')

    const { default: OrgSubscription } = await import('./org-subscription.model')
    const inUse = await OrgSubscription.count({
      where: { plan_id: id, status: { [Op.ne]: 'cancelled' } },
      transaction: t,
    })
    if (inUse > 0) throw new Error('PLAN_IN_USE')

    await plan.update({ deleted_by: actorId }, { transaction: t })
    await plan.destroy({ transaction: t })
    logger.info({ planId: id, actorId }, 'billing plan soft-deleted')
  })
}

async function getPlanInTransaction(id: string, t: import('sequelize').Transaction) {
  return BillingPlan.findByPk(id, { include: PLAN_INCLUDE, transaction: t })
}
