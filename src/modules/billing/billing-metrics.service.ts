import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import BillingMetric from './billing-metric.model'
import type { BillingMetricInput, BillingMetricUpdateInput, BillingMetricQuery } from './billing-metric.schema'

export async function listMetrics(query: BillingMetricQuery) {
  const { page, limit, search, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (typeof is_active === 'boolean') where.is_active = is_active
  if (search) {
    where[Op.or as unknown as string] = [
      { label: { [Op.iLike]: `%${search}%` } },
      { key: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await BillingMetric.findAndCountAll({
    where,
    limit,
    offset,
    order: [['label', 'ASC']],
  })

  return toPaginated(rows, count, page, limit)
}

export async function createMetric(input: BillingMetricInput, actorId: string) {
  const metric = await BillingMetric.create({
    ...input,
    unit_label: input.unit_label ?? null,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ metricId: metric.id, key: metric.key, actorId }, 'billing metric created')
  return metric
}

export async function updateMetric(id: string, input: BillingMetricUpdateInput, actorId: string) {
  const metric = await BillingMetric.findByPk(id)
  if (!metric) throw new Error('METRIC_NOT_FOUND')
  await metric.update({ ...input, updated_by: actorId })
  logger.info({ metricId: id, actorId }, 'billing metric updated')
  return metric
}
