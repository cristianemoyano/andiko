import type { Transaction } from 'sequelize'
import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import BillingMetric from './billing-metric.model'
import {
  TRACKED_BILLING_METRICS,
  getTrackedBillingMetric,
  isTrackedBillingMetricKey,
} from './billing-metrics.catalog'
import type { BillingMetricInput, BillingMetricUpdateInput, BillingMetricQuery } from './billing-metric.schema'
import { syncCatalogMetrics as syncCatalogMetricsCore } from './billing-metrics.sync'

export type BillingMetricCatalogEntry = {
  key: string
  label: string
  unit_label: string
  default_unit_price: string
  description: string
  tracked_by: string
  configured: boolean
  metric_id: string | null
  unit_price: string | null
  is_active: boolean | null
}

export async function listMetricsCatalog(): Promise<BillingMetricCatalogEntry[]> {
  const configured = await BillingMetric.findAll({
    where: { key: { [Op.in]: TRACKED_BILLING_METRICS.map(m => m.key) } },
  })
  const byKey = new Map(configured.map(m => [m.key, m]))

  return TRACKED_BILLING_METRICS.map(def => {
    const row = byKey.get(def.key)
    return {
      key: def.key,
      label: def.label,
      unit_label: def.unit_label,
      default_unit_price: def.default_unit_price,
      description: def.description,
      tracked_by: def.tracked_by,
      configured: !!row,
      metric_id: row?.id ?? null,
      unit_price: row?.unit_price ?? null,
      is_active: row?.is_active ?? null,
    }
  })
}

export async function syncCatalogMetrics(actorId: string, t?: Transaction) {
  const result = await syncCatalogMetricsCore(actorId, t)
  if (result.created > 0) {
    logger.info({ created: result.created, total: result.total, actorId }, 'billing metrics synced from catalog')
  }
  return result
}

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
  if (!isTrackedBillingMetricKey(input.key)) {
    throw new Error('METRIC_KEY_UNKNOWN')
  }
  const existing = await BillingMetric.findOne({ where: { key: input.key } })
  if (existing) {
    throw new Error('METRIC_KEY_EXISTS')
  }
  const def = getTrackedBillingMetric(input.key)!
  const metric = await BillingMetric.create({
    key: input.key,
    label: input.label.trim() || def.label,
    unit_label: input.unit_label?.trim() || def.unit_label,
    unit_price: def.default_unit_price,
    is_active: input.is_active ?? true,
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
