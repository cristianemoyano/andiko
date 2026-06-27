import 'server-only'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import BillingPayment from './billing-payment.model'
import BillingInvoice from './billing-invoice.model'
import { recalcBillingInvoiceBalance } from './billing-invoices.service'
import { nextBillingNumber } from './billing.numbering'
import type { BillingPaymentInput, BillingPaymentQuery } from './billing-payment.schema'

export async function listBillingPayments(query: BillingPaymentQuery) {
  const { page, limit, org_id, invoice_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (org_id)     where.org_id = org_id
  if (invoice_id) where.invoice_id = invoice_id

  const { rows, count } = await BillingPayment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['payment_date', 'DESC']],
  })

  return toPaginated(rows, count, page, limit)
}

export async function createBillingPayment(input: BillingPaymentInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await BillingInvoice.findByPk(input.invoice_id, { transaction: t, lock: true })
    if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')
    if (invoice.status === 'void')  throw new Error('BILLING_INVOICE_VOID')
    if (invoice.status === 'draft') throw new Error('BILLING_INVOICE_NOT_ISSUED')
    if (invoice.status === 'paid')  throw new Error('BILLING_INVOICE_ALREADY_PAID')

    const amount = new Decimal(input.amount)
    if (amount.lte(0)) throw new Error('BILLING_PAYMENT_INVALID_AMOUNT')
    if (amount.gt(invoice.balance)) throw new Error('BILLING_PAYMENT_EXCEEDS_BALANCE')

    const payment_number = await nextBillingNumber('payment', t)

    const payment = await BillingPayment.create(
      {
        invoice_id:     input.invoice_id,
        org_id:         invoice.org_id,
        payment_number,
        payment_date:   input.payment_date ?? new Date(),
        amount:         amount.toFixed(2),
        payment_method: input.payment_method,
        reference:      input.reference ?? null,
        notes:          input.notes ?? null,
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t },
    )

    await recalcBillingInvoiceBalance(input.invoice_id, t)

    logger.info({ paymentId: payment.id, invoiceId: input.invoice_id, orgId: invoice.org_id, actorId }, 'billing payment registered')
    return payment
  })
}

export async function deleteBillingPayment(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await BillingPayment.findByPk(id, { transaction: t })
    if (!payment) throw new Error('BILLING_PAYMENT_NOT_FOUND')

    const invoiceId = payment.invoice_id
    await payment.update({ deleted_by: actorId }, { transaction: t })
    await payment.destroy({ transaction: t })
    await recalcBillingInvoiceBalance(invoiceId, t)

    logger.info({ paymentId: id, actorId }, 'billing payment soft-deleted')
  })
}
