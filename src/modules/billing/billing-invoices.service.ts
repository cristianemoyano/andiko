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
import SubscriptionExtra from './subscription-extra.model'
import SubscriptionMetricAllowance from './subscription-metric-allowance.model'
import BillingPlan from './billing-plan.model'
import Organization from '@/modules/auth/organization.model'
import { nextBillingNumber } from './billing.numbering'
import { markUsageInvoiced, unmarkUsageInvoiced } from './usage.service'
import { getResolvedBillerSettings } from './platform-billing-settings.service'
import { buildSubscriptionChargeInput, buildChargeLines } from './billing-charges.service'
import { advanceSubscriptionPeriod, resolveSubscriptionPeriod } from './billing-period.service'
import { reactivateSubscriptionOnPayment } from './billing-dunning.service'
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

const ORG_INCLUDE = {
  model: Organization,
  as: 'organization',
  attributes: ['id', 'name', 'legal_name'],
}

export async function getBillingInvoice(id: string) {
  const invoice = await BillingInvoice.findByPk(id, {
    include: [
      ORG_INCLUDE,
      { model: BillingInvoiceItem, as: 'items' },
      { model: BillingPayment, as: 'payments', where: { deleted_at: null }, required: false },
      {
        model: OrgSubscription,
        as: 'subscription',
        include: [{ model: BillingPlan, as: 'plan' }],
      },
    ],
    order: [[{ model: BillingInvoiceItem, as: 'items' }, 'sort_order', 'ASC']],
  })
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
  return invoice
}

export async function generateInvoiceForPeriod(input: GenerateInvoiceInput, actorId: string | null) {
  return sequelize.transaction(async (t) => {
    const sub = await OrgSubscription.findByPk(input.subscription_id, {
      include: [
        { model: BillingPlan, as: 'plan' },
        { model: SubscriptionAddon, as: 'addons' },
        { model: SubscriptionExtra, as: 'extras' },
        { model: SubscriptionMetricAllowance, as: 'metric_allowances' },
      ],
      transaction: t,
    })
    if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')

    const plan = (sub as unknown as { plan: BillingPlan | null }).plan
    if (!plan) throw new Error('PLAN_NOT_FOUND')

    const resolved = resolveSubscriptionPeriod(sub)
    const periodStart = input.period_start ?? resolved.periodStart
    const periodEnd = input.period_end ?? resolved.periodEnd

    const { chargeInput, seatCount, branchCount, siteCount } = await buildSubscriptionChargeInput(sub, periodStart, periodEnd, t)
    const { lines, totals } = buildChargeLines(chargeInput)
    const invoice_number = await nextBillingNumber('invoice', t)

    const invoice = await BillingInvoice.create(
      {
        org_id:          sub.org_id,
        subscription_id: sub.id,
        invoice_number,
        status:          'draft',
        period_start:    periodStart,
        period_end:      periodEnd,
        due_date:        input.due_date ?? null,
        currency:        plan.currency,
        subtotal:        totals.subtotal,
        tax_amount:      totals.tax_amount,
        total:           totals.total,
        paid_amount:     '0.00',
        balance:         totals.total,
        billed_seats:    seatCount,
        billed_branches: branchCount,
        billed_sites:    siteCount,
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

    await markUsageInvoiced(sub.id, periodStart, periodEnd, t)
    await advanceSubscriptionPeriod(sub.id, t)

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

    // Snapshot the platform issuer ("emisor") onto the invoice at issue time so
    // it stays accurate even if the platform later changes its fiscal details.
    const issuer = await getResolvedBillerSettings()

    await invoice.update(
      {
        status: 'issued',
        issue_date,
        due_date,
        updated_by: actorId,
        issuer_legal_name:     issuer?.legal_name ?? null,
        issuer_cuit:           issuer?.cuit ?? null,
        issuer_iva_condition:  issuer?.iva_condition ?? null,
        issuer_fiscal_address: issuer?.fiscal_address ?? null,
        issuer_gross_income:   issuer?.gross_income ?? null,
        issuer_email:          issuer?.email ?? null,
        issuer_phone:          issuer?.phone ?? null,
      },
      { transaction: t },
    )
    if (!issuer) {
      logger.warn({ invoiceId: id, actorId }, 'billing invoice issued without configured issuer details')
    }
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
    if (invoice.subscription_id) {
      await unmarkUsageInvoiced(invoice.subscription_id, invoice.period_start, invoice.period_end, t)
    }
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

  if (status === 'paid' && invoice.org_id) {
    await reactivateSubscriptionOnPayment(invoice.org_id, invoice.subscription_id)
  }
}

function defaultDueDate(issueDate: Date): Date {
  const d = new Date(issueDate)
  d.setDate(d.getDate() + 10)
  return d
}

async function getBillingInvoiceInTransaction(id: string, t: import('sequelize').Transaction) {
  const invoice = await BillingInvoice.findByPk(id, {
    include: [{ model: BillingInvoiceItem, as: 'items' }],
    order: [[{ model: BillingInvoiceItem, as: 'items' }, 'sort_order', 'ASC']],
    transaction: t,
  })
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
  return invoice
}
