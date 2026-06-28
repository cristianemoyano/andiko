import 'server-only'
import logger from '@/lib/logger'
import UsageRecord from './usage-record.model'
import BillingMetric from './billing-metric.model'
import { getOrgSubscription } from './org-billing.service'

export type MeteredUsageInput = {
  orgId: string
  metricKey: string
  quantity: string | number
  period?: Date | string
  sourceId?: string | null
  actorId?: string | null
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Record metered usage for an org's active subscription.
 * Idempotent when sourceId is provided (same subscription + metric + source).
 */
export async function recordMeteredUsage(input: MeteredUsageInput): Promise<UsageRecord | null> {
  const metric = await BillingMetric.findOne({
    where: { key: input.metricKey, is_active: true },
  })
  if (!metric) {
    logger.warn({ orgId: input.orgId, metricKey: input.metricKey }, 'metered usage skipped — metric not found or inactive')
    return null
  }

  const sub = await getOrgSubscription(input.orgId)
  if (!sub) {
    logger.warn({ orgId: input.orgId, metricKey: input.metricKey }, 'metered usage skipped — no active subscription')
    return null
  }

  const period = toDateOnly(
    input.period instanceof Date ? input.period : input.period ? new Date(input.period) : new Date(),
  )

  if (input.sourceId) {
    const existing = await UsageRecord.findOne({
      where: {
        subscription_id: sub.id,
        metric_key: input.metricKey,
        source_id: input.sourceId,
      },
    })
    if (existing) return existing
  }

  const usage = await UsageRecord.create({
    org_id: input.orgId,
    subscription_id: sub.id,
    metric_key: input.metricKey,
    quantity: String(input.quantity),
    period,
    source_id: input.sourceId ?? null,
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
  })

  logger.info(
    { usageId: usage.id, orgId: input.orgId, subscriptionId: sub.id, metric: input.metricKey, quantity: input.quantity },
    'metered usage recorded',
  )
  return usage
}

/**
 * Upsert a **gauge** metric (current footprint, e.g. storage) for the org's active subscription:
 * one row per `(subscription, metric, sourceId)`, whose quantity is overwritten with the latest
 * measurement. Use a period-stable `sourceId` (e.g. `storage:<periodStart>`) so repeated runs
 * within a billing period update the same row instead of accumulating — `aggregateUsage` then
 * sums a single snapshot. An already-invoiced row is left untouched (no re-billing).
 *
 * Counters (per-event increments) should use {@link recordMeteredUsage} instead.
 */
export async function upsertMeteredUsage(input: MeteredUsageInput): Promise<UsageRecord | null> {
  if (!input.sourceId) throw new Error('upsertMeteredUsage requires a stable sourceId')

  const metric = await BillingMetric.findOne({ where: { key: input.metricKey, is_active: true } })
  if (!metric) {
    logger.warn({ orgId: input.orgId, metricKey: input.metricKey }, 'gauge usage skipped — metric not found or inactive')
    return null
  }

  const sub = await getOrgSubscription(input.orgId)
  if (!sub) {
    logger.warn({ orgId: input.orgId, metricKey: input.metricKey }, 'gauge usage skipped — no active subscription')
    return null
  }

  const period = toDateOnly(
    input.period instanceof Date ? input.period : input.period ? new Date(input.period) : new Date(),
  )

  const existing = await UsageRecord.findOne({
    where: { subscription_id: sub.id, metric_key: input.metricKey, source_id: input.sourceId },
  })

  if (existing) {
    if (existing.invoiced_at) return existing // already billed this period — don't re-bill
    await existing.update({
      quantity: String(input.quantity),
      period,
      recorded_at: new Date(),
      updated_by: input.actorId ?? null,
    })
    return existing
  }

  const usage = await UsageRecord.create({
    org_id: input.orgId,
    subscription_id: sub.id,
    metric_key: input.metricKey,
    quantity: String(input.quantity),
    period,
    source_id: input.sourceId,
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
  })

  logger.info(
    { usageId: usage.id, orgId: input.orgId, subscriptionId: sub.id, metric: input.metricKey, quantity: input.quantity },
    'gauge usage upserted',
  )
  return usage
}
