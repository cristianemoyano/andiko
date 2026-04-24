import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import SupplierInvoice from './supplier-invoice.model'
import SupplierInvoiceItem from './supplier-invoice-item.model'
import SupplierPayment from './supplier-payment.model'
import type { SupplierInvoiceInput, SupplierInvoiceUpdateInput, SupplierInvoiceQuery } from './supplier-invoice.schema'
import { nextPurchaseDocNumber, calcLineItem, calcDocumentTotals, calcDueDate } from './purchases.utils'
import { ensurePurchasesBranchAssociations } from './purchases-branch-associations'
import type { IvaRate } from '@/types'

export async function listSupplierInvoices(query: SupplierInvoiceQuery, orgId: string) {
  ensurePurchasesBranchAssociations()

  const { page, limit, search, status, contact_id, order_id, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (order_id)   where.order_id   = order_id
  if (search) {
    where[Op.or as unknown as string] = [
      { invoice_number:          { [Op.iLike]: `%${search}%` } },
      { supplier_invoice_number: { [Op.iLike]: `%${search}%` } },
    ]
  }
  if (overdue) {
    where.due_date = { [Op.lt]: new Date() }
    where.status   = { [Op.notIn]: ['paid', 'cancelled'] }
  }

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await SupplierInvoice.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'invoice_number', 'supplier_invoice_number', 'status',
      'contact_id', 'order_id', 'receipt_id',
      'invoice_date', 'due_date', 'payment_condition', 'currency',
      'subtotal', 'tax_amount', 'total', 'paid_amount', 'balance',
      'notes', 'created_at',
    ],
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getSupplierInvoice(id: string) {
  ensurePurchasesBranchAssociations()

  const { default: Branch }          = await import('@/modules/auth/branch.model')
  const { default: Contact }         = await import('@/modules/contacts/contact.model')
  const { default: User }            = await import('@/modules/auth/user.model')
  const { default: PurchaseOrder }   = await import('./purchase-order.model')
  const { default: PurchaseReceipt } = await import('./purchase-receipt.model')

  const invoice = await SupplierInvoice.findByPk(id, {
    include: [
      { model: Branch,          as: 'branch',   attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,         as: 'contact',  attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,            as: 'buyer',    attributes: ['id', 'name'] },
      { model: SupplierInvoiceItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: SupplierPayment, as: 'payments', where: { deleted_at: null }, required: false },
      { model: PurchaseOrder,   as: 'order',    attributes: ['id', 'order_number', 'status'], required: false },
      { model: PurchaseReceipt, as: 'receipt',  attributes: ['id', 'receipt_number', 'status'], required: false },
    ],
  })
  if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
  return invoice
}

export async function createSupplierInvoice(input: SupplierInvoiceInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...invoiceFields } = input

    const docNumber = await nextPurchaseDocNumber(orgId, branch_id, 'supplier_invoice', t)

    const lineTotals = items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct, item.iva_rate as IvaRate),
    )
    const docTotals = calcDocumentTotals(lineTotals)

    const dueDate = invoiceFields.invoice_date && invoiceFields.payment_condition
      ? calcDueDate(invoiceFields.invoice_date, invoiceFields.payment_condition)
      : invoiceFields.due_date ?? null

    const invoice = await SupplierInvoice.create(
      {
        ...invoiceFields,
        branch_id,
        org_id:         orgId,
        invoice_number: docNumber,
        buyer_id:       actorId,
        due_date:       dueDate,
        status:         'draft',
        paid_amount:    '0.00',
        balance:        docTotals.total,
        created_by:     actorId,
        updated_by:     actorId,
        ...docTotals,
      },
      { transaction: t },
    )

    await Promise.all(
      items.map((item, idx) =>
        SupplierInvoiceItem.create(
          {
            invoice_id:   invoice.id,
            org_id:       orgId,
            product_id:   item.product_id ?? null,
            variant_id:   item.variant_id ?? null,
            description:  item.description,
            quantity:     String(item.quantity),
            unit_price:   String(item.unit_price),
            discount_pct: String(item.discount_pct),
            iva_rate:     item.iva_rate as IvaRate,
            ...lineTotals[idx],
            sort_order:   item.sort_order,
            created_by:   actorId,
            updated_by:   actorId,
          },
          { transaction: t },
        ),
      ),
    )

    logger.info({ invoiceId: invoice.id, orgId, number: docNumber }, 'supplier invoice created')
    return invoice
  })
}

export async function updateSupplierInvoice(id: string, input: SupplierInvoiceUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await SupplierInvoice.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new Error('SUPPLIER_INVOICE_LOCKED')
    }

    const { items, ...fields } = input

    if (items && items.length > 0) {
      await SupplierInvoiceItem.destroy({ where: { invoice_id: id }, transaction: t })

      const lineTotals = items.map(item =>
        calcLineItem(item.quantity!, item.unit_price!, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate),
      )
      const docTotals = calcDocumentTotals(lineTotals)

      await Promise.all(
        items.map((item, idx) =>
          SupplierInvoiceItem.create(
            {
              invoice_id:   id,
              org_id:       orgId,
              product_id:   item.product_id ?? null,
              variant_id:   item.variant_id ?? null,
              description:  item.description!,
              quantity:     String(item.quantity),
              unit_price:   String(item.unit_price),
              discount_pct: String(item.discount_pct ?? 0),
              iva_rate:     (item.iva_rate ?? '21') as IvaRate,
              ...lineTotals[idx],
              sort_order:   item.sort_order ?? 0,
              created_by:   actorId,
              updated_by:   actorId,
            },
            { transaction: t },
          ),
        ),
      )

      await invoice.update(
        { ...fields, ...docTotals, balance: new Decimal(docTotals.total).minus(invoice.paid_amount).toFixed(2), updated_by: actorId },
        { transaction: t },
      )
    } else {
      await invoice.update({ ...fields, updated_by: actorId }, { transaction: t })
    }

    return invoice
  })
}

export async function deleteSupplierInvoice(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await SupplierInvoice.findOne({
      where: { id, org_id: orgId },
      transaction: t,
    })
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
    if (invoice.status !== 'draft') throw new Error('SUPPLIER_INVOICE_NOT_DRAFT')

    await invoice.update({ deleted_by: actorId }, { transaction: t })
    await invoice.destroy({ transaction: t })
  })
}

/**
 * Marks invoice as received (formally registered from the supplier).
 */
export async function receiveSupplierInvoice(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await SupplierInvoice.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
    if (invoice.status !== 'draft') throw new Error('SUPPLIER_INVOICE_NOT_DRAFT')

    const invoiceDate = invoice.invoice_date ?? new Date()
    const dueDate     = calcDueDate(invoiceDate, invoice.payment_condition)

    await invoice.update(
      {
        status:       'received',
        invoice_date: invoice.invoice_date ?? invoiceDate,
        due_date:     invoice.due_date ?? dueDate,
        updated_by:   actorId,
      },
      { transaction: t },
    )
    logger.info({ invoiceId: id }, 'supplier invoice received')
    return invoice
  })
}

/**
 * Cancels a supplier invoice that hasn't been fully paid.
 */
export async function cancelSupplierInvoice(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await SupplierInvoice.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND')
    if (invoice.status === 'paid')      throw new Error('SUPPLIER_INVOICE_ALREADY_PAID')
    if (invoice.status === 'cancelled') throw new Error('SUPPLIER_INVOICE_ALREADY_CANCELLED')

    await invoice.update({ status: 'cancelled', updated_by: actorId }, { transaction: t })
    logger.info({ invoiceId: id }, 'supplier invoice cancelled')
    return invoice
  })
}

/**
 * Recalculates `paid_amount`, `balance`, and `status` for a supplier invoice
 * based on current non-deleted payments. Called atomically within a transaction.
 */
export async function recalcSupplierInvoiceBalance(invoiceId: string, t: import('sequelize').Transaction) {
  const invoice = await SupplierInvoice.findByPk(invoiceId, { transaction: t, lock: true })
  if (!invoice || invoice.status === 'cancelled') return

  const payments = await SupplierPayment.findAll({
    where: { invoice_id: invoiceId, deleted_at: null },
    attributes: ['amount'],
    transaction: t,
  })

  const paid    = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0))
  const total   = new Decimal(invoice.total)
  const balance = total.minus(paid)

  const status =
    paid.gte(total) ? 'paid' :
    paid.gt(0)      ? 'partially_paid' :
    invoice.status === 'received' || invoice.status === 'partially_paid' ? invoice.status :
    'received'

  await invoice.update(
    { paid_amount: paid.toFixed(2), balance: balance.toFixed(2), status },
    { transaction: t },
  )
}
