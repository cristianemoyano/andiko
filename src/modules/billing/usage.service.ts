import 'server-only'
import { Op, fn, col } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import UsageRecord from './usage-record.model'
import OrgSubscription from './org-subscription.model'
import type { UsageRecordInput, UsageQuery } from './usage.schema'

export async function listUsage(query: UsageQuery) {
  const { page, limit, org_id, subscription_id, metric_key } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (org_id)          where.org_id = org_id
  if (subscription_id) where.subscription_id = subscription_id
  if (metric_key)      where.metric_key = metric_key

  const { rows, count } = await UsageRecord.findAndCountAll({
    where,
    limit,
    offset,
    order: [['period', 'DESC'], ['recorded_at', 'DESC']],
  })

  return toPaginated(rows, count, page, limit)
}

export async function recordUsage(input: UsageRecordInput, actorId: string) {
  let subscriptionId = input.subscription_id ?? null
  if (!subscriptionId) {
    const sub = await OrgSubscription.findOne({
      where: { org_id: input.org_id, status: { [Op.ne]: 'cancelled' } },
      order: [['created_at', 'DESC']],
    })
    subscriptionId = sub?.id ?? null
  }

  const usage = await UsageRecord.create({
    org_id:          input.org_id,
    subscription_id: subscriptionId,
    metric_key:      input.metric_key,
    quantity:        input.quantity,
    period:          input.period,
    created_by:      actorId,
    updated_by:      actorId,
  })
  logger.info({ usageId: usage.id, orgId: input.org_id, metric: input.metric_key, actorId }, 'usage recorded')
  return usage
}

/**
 * Aggregate un-invoiced usage by metric for a subscription within a period range.
 * Returns total quantity per metric_key.
 */
export async function aggregateUsage(
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  t?: import('sequelize').Transaction,
): Promise<{ metric_key: string; quantity: string }[]> {
  const rows = await UsageRecord.findAll({
    where: {
      subscription_id: subscriptionId,
      invoiced_at: null,
      period: {
        [Op.gte]: toDateOnly(periodStart),
        [Op.lte]: toDateOnly(periodEnd),
      },
    },
    attributes: ['metric_key', [fn('SUM', col('quantity')), 'quantity']],
    group: ['metric_key'],
    raw: true,
    transaction: t,
  }) as unknown as { metric_key: string; quantity: string }[]

  return rows.map(r => ({ metric_key: r.metric_key, quantity: String(r.quantity) }))
}

/** Mark usage records in a period as invoiced so they are not billed twice. */
export async function markUsageInvoiced(
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  t: import('sequelize').Transaction,
) {
  await UsageRecord.update(
    { invoiced_at: new Date() },
    {
      where: {
        subscription_id: subscriptionId,
        invoiced_at: null,
        period: { [Op.gte]: toDateOnly(periodStart), [Op.lte]: toDateOnly(periodEnd) },
      },
      transaction: t,
    },
  )
}

/** Revert invoiced flag when a draft/issued invoice is voided. */
export async function unmarkUsageInvoiced(
  subscriptionId: string,
  periodStart: Date | null,
  periodEnd: Date | null,
  t: import('sequelize').Transaction,
) {
  if (!periodStart || !periodEnd) return

  await UsageRecord.update(
    { invoiced_at: null },
    {
      where: {
        subscription_id: subscriptionId,
        period: { [Op.gte]: toDateOnly(periodStart), [Op.lte]: toDateOnly(periodEnd) },
      },
      transaction: t,
    },
  )
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}
