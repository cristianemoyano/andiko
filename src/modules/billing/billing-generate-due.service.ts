import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import OrgSubscription from './org-subscription.model'
import { generateInvoiceForPeriod } from './billing-invoices.service'

export interface GenerateDueBillingInvoicesResult {
  generated: number
  failed: number
  examined: number
  active_subscriptions: number
  next_period_end: string | null
  details: Array<{
    subscription_id: string
    org_id: string | null
    status: 'generated' | 'failed'
    invoice_id?: string
    error?: string
  }>
}

const ACTIVE_STATUSES = ['active', 'trialing'] as const

/** Snapshot of who would be billed now vs when the next period ends. */
export async function getBillingDuePreview(now: Date = new Date()): Promise<{
  active_subscriptions: number
  due_subscriptions: number
  next_period_end: string | null
}> {
  const [active_subscriptions, due_subscriptions, nextEnding] = await Promise.all([
    OrgSubscription.count({
      where: { status: { [Op.in]: [...ACTIVE_STATUSES] } },
    }),
    OrgSubscription.count({
      where: {
        status: { [Op.in]: [...ACTIVE_STATUSES] },
        current_period_end: { [Op.lte]: now },
      },
    }),
    OrgSubscription.findOne({
      where: {
        status: { [Op.in]: [...ACTIVE_STATUSES] },
        current_period_end: { [Op.gt]: now },
      },
      attributes: ['current_period_end'],
      order: [['current_period_end', 'ASC']],
    }),
  ])

  return {
    active_subscriptions,
    due_subscriptions,
    next_period_end: nextEnding?.current_period_end?.toISOString() ?? null,
  }
}

/**
 * Generates draft platform invoices for every active/trialing subscription whose
 * `current_period_end` is in the past. Failures are isolated per subscription.
 */
export async function generateDueBillingInvoices(
  actorId: string | null,
  now: Date = new Date(),
): Promise<GenerateDueBillingInvoicesResult> {
  const preview = await getBillingDuePreview(now)

  const due = await OrgSubscription.findAll({
    where: {
      status: { [Op.in]: [...ACTIVE_STATUSES] },
      current_period_end: { [Op.lte]: now },
    },
    attributes: ['id', 'org_id', 'current_period_end'],
    limit: 500,
  })

  const details: GenerateDueBillingInvoicesResult['details'] = []
  let generated = 0
  let failed = 0

  for (const sub of due) {
    try {
      const invoice = await generateInvoiceForPeriod(
        { subscription_id: sub.id },
        actorId,
      )
      generated += 1
      details.push({
        subscription_id: sub.id,
        org_id: sub.org_id,
        status: 'generated',
        invoice_id: invoice.id,
      })
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error(
        { err, subscriptionId: sub.id, orgId: sub.org_id },
        'billing due invoice generation failed',
      )
      details.push({
        subscription_id: sub.id,
        org_id: sub.org_id,
        status: 'failed',
        error: message,
      })
    }
  }

  return {
    generated,
    failed,
    examined: due.length,
    active_subscriptions: preview.active_subscriptions,
    next_period_end: preview.next_period_end,
    details,
  }
}
