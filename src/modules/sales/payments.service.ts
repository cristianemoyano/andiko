import 'server-only'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import Payment from './payment.model'
import Invoice from './invoice.model'
import User from '@/modules/auth/user.model'
import { recalcInvoiceBalance } from './invoices.service'
import type { PaymentInput, PaymentUpdateInput, PaymentQuery } from './payment.schema'
import { nextDocumentNumber } from './sales.utils'
import { type TenantContext } from '@/lib/tenancy'
import { whereSalesDocumentScope } from './sales-scope'

export async function listPayments(query: PaymentQuery, ctx: TenantContext) {
  const { page, limit, invoice_id, contact_id, payment_method } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereSalesDocumentScope(ctx) as Record<string, unknown>
  if (invoice_id)     where.invoice_id     = invoice_id
  if (contact_id)     where.contact_id     = contact_id
  if (payment_method) where.payment_method = payment_method

  const { rows, count } = await Payment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['payment_date', 'DESC']],
    attributes: [
      'id', 'payment_number', 'invoice_id', 'contact_id',
      'payment_date', 'amount', 'payment_method', 'reference', 'notes',
      'created_at',
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getPayment(id: string, ctx: TenantContext) {
  const payment = await Payment.findOne({
    where: whereSalesDocumentScope(ctx, { id }),
    include: [{ model: User, as: 'salesperson', attributes: ['id', 'name'] }],
  })
  if (!payment) throw new Error('PAYMENT_NOT_FOUND')
  return payment
}

export async function createPayment(input: PaymentInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findOne({
      where: whereSalesDocumentScope(ctx, { id: input.invoice_id }),
      transaction: t,
    })
    if (!invoice) throw new Error('INVOICE_NOT_FOUND')
    if (invoice.status === 'cancelled') throw new Error('INVOICE_CANCELLED')
    if (invoice.status === 'draft')     throw new Error('INVOICE_NOT_ISSUED')
    if (invoice.status === 'paid')      throw new Error('INVOICE_ALREADY_PAID')
    if (!invoice.branch_id) throw new Error('INVOICE_BRANCH_REQUIRED')

    const payment_number = await nextDocumentNumber(ctx.orgId, invoice.branch_id, 'payment', t)

    const payment = await Payment.create(
      {
        ...input,
        branch_id:      invoice.branch_id,
        payment_number,
        salesperson_id: actorId,
        org_id:     ctx.orgId,
        amount:     String(input.amount),
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    await recalcInvoiceBalance(input.invoice_id, t)

    logger.info({ paymentId: payment.id, invoiceId: input.invoice_id, orgId: ctx.orgId, actorId }, 'payment registered')
    return payment
  })
}

export async function updatePayment(id: string, input: PaymentUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await Payment.findOne({
      where: whereSalesDocumentScope(ctx, { id }),
      transaction: t,
    })
    if (!payment) throw new Error('PAYMENT_NOT_FOUND')

    const { amount, ...rest } = input
    const updateData: Record<string, unknown> = { ...rest, updated_by: actorId }
    if (amount !== undefined) updateData.amount = String(amount)

    await payment.update(updateData as Parameters<typeof payment.update>[0], { transaction: t })
    await recalcInvoiceBalance(payment.invoice_id, t)

    logger.info({ paymentId: id, actorId }, 'payment updated')
    return payment.reload({ transaction: t })
  })
}

export async function deletePayment(id: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await Payment.findOne({
      where: whereSalesDocumentScope(ctx, { id }),
      transaction: t,
    })
    if (!payment) throw new Error('PAYMENT_NOT_FOUND')

    const invoiceId = payment.invoice_id
    await payment.update({ deleted_by: actorId }, { transaction: t })
    await payment.destroy({ transaction: t })
    await recalcInvoiceBalance(invoiceId, t)

    logger.info({ paymentId: id, actorId }, 'payment soft-deleted')
  })
}
