import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import Invoice from './invoice.model'
import InvoiceItem from './invoice-item.model'
import Payment from './payment.model'
import type { InvoiceInput, InvoiceUpdateInput, InvoiceQuery } from './invoice.schema'
import { ensureSalesBranchAssociations } from './sales-branch-associations'
import { nextDocumentNumber, calcLineItem, calcDocumentTotals } from './sales.utils'
import type { IvaRate } from '@/types'

export async function listInvoices(query: InvoiceQuery, orgId: string) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const { page, limit, search, status, contact_id, order_id, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (order_id)   where.order_id   = order_id
  if (search) {
    where[Op.or as unknown as string] = [
      { invoice_number: { [Op.iLike]: `%${search}%` } },
    ]
  }
  if (overdue) {
    where.due_date = { [Op.lt]: new Date() }
    where.status   = { [Op.notIn]: ['paid', 'cancelled'] }
  }

  const { rows, count } = await Invoice.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'invoice_number', 'status', 'contact_id', 'order_id',
      'issue_date', 'due_date', 'payment_condition', 'currency',
      'subtotal', 'tax_amount', 'total', 'paid_amount', 'balance',
      'notes', 'created_at',
    ],
    include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] }],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getInvoice(id: string) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const invoice = await Invoice.findByPk(id, {
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: InvoiceItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: Payment, as: 'payments', where: { deleted_at: null }, required: false },
    ],
  })
  if (!invoice) throw new Error('INVOICE_NOT_FOUND')
  return invoice
}

export async function createInvoice(input: InvoiceInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...invoiceFields } = input

    const order = await (await import('./sales-order.model')).default.findOne({
      where: { id: input.order_id, org_id: orgId },
      attributes: ['id', 'status'],
      transaction: t,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (order.status !== 'delivered') throw new Error('ORDER_NOT_DELIVERED')

    const invoice_number = await nextDocumentNumber(orgId, branch_id, 'invoice', t)

    const itemTotals = items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
    )
    const docTotals = calcDocumentTotals(itemTotals)

    const invoice = await Invoice.create(
      {
        ...invoiceFields,
        branch_id,
        invoice_number,
        org_id:     orgId,
        balance:    docTotals.total,
        created_by: actorId,
        updated_by: actorId,
        ...docTotals,
      },
      { transaction: t },
    )

    await InvoiceItem.bulkCreate(
      items.map((item, idx) => ({
        invoice_id:   invoice.id,
        org_id:       orgId,
        product_id:   item.product_id ?? null,
        description:  item.description,
        quantity:     String(item.quantity),
        unit_price:   String(item.unit_price),
        discount_pct: String(item.discount_pct ?? 0),
        iva_rate:     (item.iva_rate ?? '21') as IvaRate,
        sort_order:   item.sort_order ?? idx,
        created_by:   actorId,
        updated_by:   actorId,
        ...itemTotals[idx],
      })),
      { transaction: t },
    )

    logger.info({ invoiceId: invoice.id, invoice_number, orgId, actorId }, 'invoice created')
    return getInvoiceInTransaction(invoice.id, t)
  })
}

export async function updateInvoice(id: string, input: InvoiceUpdateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(id, { transaction: t })
    if (!invoice) throw new Error('INVOICE_NOT_FOUND')
    if (invoice.status !== 'draft') throw new Error('INVOICE_NOT_EDITABLE')

    const updateData: Record<string, unknown> = { updated_by: actorId }

    if (input.items) {
      const itemTotals = input.items.map(item =>
        calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
      )
      const docTotals = calcDocumentTotals(itemTotals)

      await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t, force: false })

      await InvoiceItem.bulkCreate(
        input.items.map((item, idx) => ({
          invoice_id:   id,
          org_id:       invoice.org_id,
          product_id:   item.product_id ?? null,
          description:  item.description,
          quantity:     String(item.quantity),
          unit_price:   String(item.unit_price),
          discount_pct: String(item.discount_pct ?? 0),
          iva_rate:     (item.iva_rate ?? '21') as IvaRate,
          sort_order:   item.sort_order ?? idx,
          created_by:   actorId,
          updated_by:   actorId,
          ...itemTotals[idx],
        })),
        { transaction: t },
      )

      Object.assign(updateData, { ...docTotals, balance: docTotals.total })
    }

    const { items: discardedItems, branch_id: discardedBranch, ...rest } = input
    void discardedItems
    void discardedBranch
    await invoice.update({ ...rest, ...updateData }, { transaction: t })

    logger.info({ invoiceId: id, actorId }, 'invoice updated')
    return getInvoiceInTransaction(id, t)
  })
}

export async function deleteInvoice(id: string, actorId: string) {
  const invoice = await Invoice.findByPk(id)
  if (!invoice) throw new Error('INVOICE_NOT_FOUND')
  if (invoice.status !== 'draft') throw new Error('INVOICE_NOT_DELETABLE')

  await invoice.update({ deleted_by: actorId })
  await invoice.destroy()
  logger.info({ invoiceId: id, actorId }, 'invoice soft-deleted')
}

export async function issueInvoice(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(id, { transaction: t })
    if (!invoice) throw new Error('INVOICE_NOT_FOUND')
    if (invoice.status !== 'draft') throw new Error('INVOICE_ALREADY_ISSUED')

    const issue_date = new Date()
    const due_date   = invoice.due_date ?? computeDueDate(issue_date, invoice.payment_condition)

    await invoice.update(
      { status: 'issued', issue_date, due_date, updated_by: actorId },
      { transaction: t },
    )

    logger.info({ invoiceId: id, actorId }, 'invoice issued')
    return invoice.reload({ transaction: t })
  })
}

export async function cancelInvoice(id: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(id, { transaction: t })
    if (!invoice) throw new Error('INVOICE_NOT_FOUND')
    if (invoice.status === 'paid') throw new Error('INVOICE_PAID_NOT_CANCELLABLE')
    if (invoice.status === 'cancelled') throw new Error('INVOICE_ALREADY_CANCELLED')

    await invoice.update(
      { status: 'cancelled', updated_by: actorId },
      { transaction: t },
    )

    logger.info({ invoiceId: id, actorId }, 'invoice cancelled')
    return invoice.reload({ transaction: t })
  })
}

export async function recalcInvoiceBalance(invoiceId: string, t: import('sequelize').Transaction) {
  const invoice  = await Invoice.findByPk(invoiceId, { transaction: t, lock: true })
  if (!invoice) throw new Error('INVOICE_NOT_FOUND')

  const payments = await Payment.findAll({ where: { invoice_id: invoiceId }, transaction: t })
  const paid_amount = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0))
  const balance     = new Decimal(invoice.total).minus(paid_amount)

  let status = invoice.status
  if (balance.lte(0)) {
    status = 'paid'
  } else if (paid_amount.gt(0)) {
    status = 'partially_paid'
  } else if (status === 'partially_paid' || status === 'paid') {
    status = 'issued'
  }

  await invoice.update(
    { paid_amount: paid_amount.toFixed(2), balance: balance.toFixed(2), status },
    { transaction: t },
  )
}

function computeDueDate(issueDate: Date, paymentCondition: string): Date {
  const days: Record<string, number> = { cash: 0, net_30: 30, net_60: 60, net_90: 90 }
  const d = new Date(issueDate)
  d.setDate(d.getDate() + (days[paymentCondition] ?? 0))
  return d
}

async function getInvoiceInTransaction(id: string, t: import('sequelize').Transaction) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  return Invoice.findByPk(id, {
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: InvoiceItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
    transaction: t,
  })
}
