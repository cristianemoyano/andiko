import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import BillingInvoice from './billing-invoice.model'
import BillingInvoiceItem from './billing-invoice-item.model'
import BillingPayment from './billing-payment.model'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import BillingPlan from './billing-plan.model'
import BillingMetric from './billing-metric.model'
import { calcSubscriptionCharges, calcBillingTotals } from './billing.math'
import { nextBillingNumber } from './billing.numbering'
import { aggregateUsage, markUsageInvoiced } from './usage.service'
import type { GenerateInvoiceInput, BillingInvoiceQuery } from './billing-invoice.schema'

export async function listBillingInvoices(query: BillingInvoiceQuery) {
  const { page, limit, org_id, subscription_id, status, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (org_id)          where.org_id = org_id
  if (subscription_id) where.subscription_id = subscription_id
  if (status)          where.status = status
  if (overdue) {
    where.due_date = { [Op.lt]: new Date() }
    if (!status) where.status = { [Op.notIn]: ['paid', 'void'] }
  }

  const { rows, count } = await BillingInvoice.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [{ model: OrgSubscription, as: 'subscription', include: [{ model: BillingPlan, as: 'plan' }] }],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getBillingInvoice(id: string) {
  const invoice = await BillingInvoice.findByPk(id, {
    include: [
      { model: BillingInvoiceItem, as: 'items' },
      { model: BillingPayment, as: 'payments', where: { deleted_at: null }, required: false },
      { model: OrgSubscription, as: 'subscription', include: [{ model: BillingPlan, as: 'plan' }] },
    ],
    order: [[{ model: BillingInvoiceItem, as: 'items' }, 'sort_order', 'ASC']],
  })
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
  return invoice
}

export async function generateInvoiceForPeriod(input: GenerateInvoiceInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const sub = await OrgSubscription.findByPk(input.subscription_id, {
      include: [
        { model: BillingPlan, as: 'plan' },
        { model: SubscriptionAddon, as: 'addons' },
      ],
      transaction: t,
    })
    if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')

    const plan = (sub as unknown as { plan: BillingPlan | null }).plan
    if (!plan) throw new Error('PLAN_NOT_FOUND')
    const addons = (sub as unknown as { addons: SubscriptionAddon[] }).addons ?? []

    // Aggregate usage and resolve metric pricing
    const usageTotals = await aggregateUsage(sub.id, input.period_start, input.period_end, t)
    const metricKeys = usageTotals.map(u => u.metric_key)
    const metrics = metricKeys.length
      ? await BillingMetric.findAll({ where: { key: { [Op.in]: metricKeys } }, transaction: t })
      : []
    const metricByKey = new Map(metrics.map(m => [m.key, m]))

    const usageLines = usageTotals
      .map(u => {
        const m = metricByKey.get(u.metric_key)
        if (!m) return null
        return {
          metric_key: u.metric_key,
          label:      m.label,
          unit_label: m.unit_label,
          unit_price: m.unit_price,
          quantity:   u.quantity,
        }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)

    const lines = calcSubscriptionCharges({
      plan: {
        name:           plan.name,
        base_price:     plan.base_price,
        included_seats: plan.included_seats,
        per_seat_price: plan.per_seat_price,
      },
      seats:  sub.seats,
      addons: addons.map(a => ({ module_key: a.module_key, unit_price: a.unit_price, enabled: a.enabled })),
      usage:  usageLines,
    })

    const totals = calcBillingTotals(lines)
    const invoice_number = await nextBillingNumber('invoice', t)

    const invoice = await BillingInvoice.create(
      {
        org_id:          sub.org_id,
        subscription_id: sub.id,
        invoice_number,
        status:          'draft',
        period_start:    input.period_start,
        period_end:      input.period_end,
        due_date:        input.due_date ?? null,
        currency:        plan.currency,
        subtotal:        totals.subtotal,
        tax_amount:      totals.tax_amount,
        total:           totals.total,
        paid_amount:     '0.00',
        balance:         totals.total,
        notes:           input.notes ?? null,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )

    await BillingInvoiceItem.bulkCreate(
      lines.map((l, idx) => ({
        invoice_id:  invoice.id,
        org_id:      sub.org_id,
        kind:        l.kind,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        iva_rate:    l.iva_rate,
        subtotal:    l.subtotal,
        tax_base:    l.tax_base,
        tax_amount:  l.tax_amount,
        total:       l.total,
        sort_order:  idx,
        created_by:  actorId,
        updated_by:  actorId,
      })),
      { transaction: t },
    )

    await markUsageInvoiced(sub.id, input.period_start, input.period_end, t)

    logger.info({ invoiceId: invoice.id, invoice_number, subscriptionId: sub.id, orgId: sub.org_id, actorId }, 'billing invoice generated')
    return getBillingInvoiceInTransaction(invoice.id, t)
  })
}

export async function issueBillingInvoice(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await BillingInvoice.findByPk(id, { transaction: t })
    if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
    if (invoice.status !== 'draft') throw new Error('BILLING_INVOICE_ALREADY_ISSUED')

    const issue_date = new Date()
    const due_date = invoice.due_date ?? defaultDueDate(issue_date)

    await invoice.update({ status: 'issued', issue_date, due_date, updated_by: actorId }, { transaction: t })
    logger.info({ invoiceId: id, actorId }, 'billing invoice issued')
    return await invoice.reload({ transaction: t })
  })
}

export async function voidBillingInvoice(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await BillingInvoice.findByPk(id, { transaction: t })
    if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
    if (invoice.status === 'paid') throw new Error('BILLING_INVOICE_PAID_NOT_VOIDABLE')
    if (invoice.status === 'void') throw new Error('BILLING_INVOICE_ALREADY_VOID')
    if (new Decimal(invoice.paid_amount).gt(0)) throw new Error('BILLING_INVOICE_HAS_PAYMENTS')

    await invoice.update({ status: 'void', updated_by: actorId }, { transaction: t })
    logger.info({ invoiceId: id, actorId }, 'billing invoice voided')
    return await invoice.reload({ transaction: t })
  })
}

export async function recalcBillingInvoiceBalance(invoiceId: string, t: import('sequelize').Transaction) {
  const invoice = await BillingInvoice.findByPk(invoiceId, { transaction: t, lock: true })
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')

  const payments = await BillingPayment.findAll({ where: { invoice_id: invoiceId }, transaction: t })
  const paid_amount = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0))
  const balance     = new Decimal(invoice.total).minus(paid_amount)

  let status = invoice.status
  if (status !== 'void') {
    if (balance.lte(0) && paid_amount.gt(0)) {
      status = 'paid'
    } else if (paid_amount.gt(0)) {
      status = 'partially_paid'
    } else if (status === 'partially_paid' || status === 'paid') {
      status = 'issued'
    }
  }

  await invoice.update(
    { paid_amount: paid_amount.toFixed(2), balance: balance.toFixed(2), status },
    { transaction: t },
  )
}

function defaultDueDate(issueDate: Date): Date {
  const d = new Date(issueDate)
  d.setDate(d.getDate() + 10)
  return d
}

async function getBillingInvoiceInTransaction(id: string, t: import('sequelize').Transaction) {
  return BillingInvoice.findByPk(id, {
    include: [{ model: BillingInvoiceItem, as: 'items' }],
    order: [[{ model: BillingInvoiceItem, as: 'items' }, 'sort_order', 'ASC']],
    transaction: t,
  })
}
