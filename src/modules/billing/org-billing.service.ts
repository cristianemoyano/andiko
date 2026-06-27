import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import { paginate, toPaginated } from '@/lib/pagination'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import BillingPlan from './billing-plan.model'
import BillingMetric from './billing-metric.model'
import BillingInvoice from './billing-invoice.model'
import BillingInvoiceItem from './billing-invoice-item.model'
import BillingPayment from './billing-payment.model'
import { aggregateUsage } from './usage.service'

export type OrgUsageLine = {
  metric_key: string
  label: string
  unit_label: string | null
  unit_price: string
  quantity: string
  amount: string
}

export type OrgUsageSummary = {
  period_start: string
  period_end: string
  lines: OrgUsageLine[]
  total: string
}

/** Current (non-cancelled) subscription for the org, with plan + add-ons. */
export async function getOrgSubscription(orgId: string) {
  return OrgSubscription.findOne({
    where: { org_id: orgId, status: { [Op.ne]: 'cancelled' } },
    order: [['created_at', 'DESC']],
    include: [
      { model: BillingPlan, as: 'plan' },
      { model: SubscriptionAddon, as: 'addons' },
    ],
  })
}

/**
 * Un-invoiced usage for the subscription's current period, priced per metric.
 * Falls back to the current calendar month when no period is set on the
 * subscription yet.
 */
export async function getOrgCurrentUsage(sub: OrgSubscription): Promise<OrgUsageSummary> {
  const now = new Date()
  const periodStart = sub.current_period_start ?? startOfMonthUTC(now)
  const periodEnd = sub.current_period_end ?? now

  const totals = await aggregateUsage(sub.id, periodStart, periodEnd)
  const keys = totals.map(t => t.metric_key)
  const metrics = keys.length
    ? await BillingMetric.findAll({ where: { key: { [Op.in]: keys } } })
    : []
  const byKey = new Map(metrics.map(m => [m.key, m]))

  const lines: OrgUsageLine[] = totals.flatMap(t => {
    const metric = byKey.get(t.metric_key)
    if (!metric) return []
    const amount = new Decimal(metric.unit_price).times(t.quantity)
    return [{
      metric_key: t.metric_key,
      label: metric.label,
      unit_label: metric.unit_label,
      unit_price: metric.unit_price,
      quantity: t.quantity,
      amount: amount.toFixed(2),
    }]
  })

  const total = lines.reduce((acc, l) => acc.plus(l.amount), new Decimal(0)).toFixed(2)

  return {
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    lines,
    total,
  }
}

/** Paginated invoices for the org, most recent first. */
export async function listOrgInvoices(orgId: string, page: number, limit: number) {
  const { offset } = paginate(page, limit)
  const { rows, count } = await BillingInvoice.findAndCountAll({
    where: { org_id: orgId },
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [{ model: OrgSubscription, as: 'subscription', include: [{ model: BillingPlan, as: 'plan' }] }],
  })
  return toPaginated(rows, count, page, limit)
}

/** Single invoice with items + payments, scoped to the org. */
export async function getOrgInvoice(orgId: string, id: string) {
  const invoice = await BillingInvoice.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: BillingInvoiceItem, as: 'items' },
      { model: BillingPayment, as: 'payments', where: { deleted_at: null }, required: false },
    ],
    order: [[{ model: BillingInvoiceItem, as: 'items' }, 'sort_order', 'ASC']],
  })
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
  return invoice
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
