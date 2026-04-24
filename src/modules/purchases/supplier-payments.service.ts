import 'server-only'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import SupplierPayment from './supplier-payment.model'
import SupplierInvoice from './supplier-invoice.model'
import type { SupplierPaymentInput, SupplierPaymentUpdateInput, SupplierPaymentQuery } from './supplier-payment.schema'
import { nextPurchaseDocNumber } from './purchases.utils'
import { recalcSupplierInvoiceBalance } from './supplier-invoices.service'
import { ensurePurchasesBranchAssociations } from './purchases-branch-associations'

export async function listSupplierPayments(query: SupplierPaymentQuery, orgId: string) {
  ensurePurchasesBranchAssociations()

  const { page, limit, invoice_id, contact_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (invoice_id) where.invoice_id = invoice_id
  if (contact_id) where.contact_id = contact_id

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await SupplierPayment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['payment_date', 'DESC']],
    attributes: [
      'id', 'branch_id', 'invoice_id', 'contact_id',
      'payment_number', 'payment_date', 'amount', 'payment_method',
      'notes', 'created_at',
    ],
    include: [
      { model: Branch,         as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,        as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: SupplierInvoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total', 'balance'] },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getSupplierPayment(id: string, orgId: string) {
  ensurePurchasesBranchAssociations()

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const payment = await SupplierPayment.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch,         as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,        as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: SupplierInvoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total', 'balance'] },
    ],
  })
  if (!payment) throw new Error('SUPPLIER_PAYMENT_NOT_FOUND')
  return payment
}

export async function createSupplierPayment(input: SupplierPaymentInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await SupplierInvoice.findOne({
      where: { id: input.invoice_id, org_id: orgId },
      attributes: ['id', 'status', 'branch_id', 'contact_id'],
      transaction: t,
    })
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
    if (invoice.status === 'cancelled') throw new Error('SUPPLIER_INVOICE_CANCELLED')
    if (invoice.status === 'paid')      throw new Error('SUPPLIER_INVOICE_ALREADY_PAID')
    if (invoice.status === 'draft')     throw new Error('SUPPLIER_INVOICE_NOT_RECEIVED')

    const branchId = input.branch_id ?? invoice.branch_id
    if (!branchId) throw new Error('SUPPLIER_PAYMENT_BRANCH_REQUIRED')

    const docNumber = await nextPurchaseDocNumber(orgId, branchId, 'supplier_payment', t)

    const payment = await SupplierPayment.create(
      {
        ...input,
        branch_id:      branchId,
        contact_id:     input.contact_id ?? invoice.contact_id ?? null,
        org_id:         orgId,
        payment_number: docNumber,
        payment_date:   input.payment_date,
        amount:         String(input.amount),
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t },
    )

    await recalcSupplierInvoiceBalance(input.invoice_id, t)

    logger.info({ paymentId: payment.id, invoiceId: input.invoice_id, orgId }, 'supplier payment created')
    return payment
  })
}

export async function updateSupplierPayment(id: string, input: SupplierPaymentUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await SupplierPayment.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!payment) throw new Error('SUPPLIER_PAYMENT_NOT_FOUND')

    await payment.update({ ...(input as object), updated_by: actorId }, { transaction: t })
    await recalcSupplierInvoiceBalance(payment.invoice_id, t)

    return payment
  })
}

export async function deleteSupplierPayment(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await SupplierPayment.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!payment) throw new Error('SUPPLIER_PAYMENT_NOT_FOUND')

    const invoiceId = payment.invoice_id
    await payment.update({ deleted_by: actorId }, { transaction: t })
    await payment.destroy({ transaction: t })

    await recalcSupplierInvoiceBalance(invoiceId, t)
    logger.info({ paymentId: id, orgId }, 'supplier payment deleted')
  })
}
