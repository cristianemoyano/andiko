import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import SalesOrder from './sales-order.model'
import SalesOrderItem from './sales-order-item.model'
import Invoice from './invoice.model'
import InvoiceItem from './invoice-item.model'
import type { SalesOrderInput, SalesOrderUpdateInput, SalesOrderQuery } from './sales-order.schema'
import { ensureSalesBranchAssociations } from './sales-branch-associations'
import { nextDocumentNumber, calcLineItem, calcDocumentTotals } from './sales.utils'
import type { IvaRate } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches, whereBranch } from '@/lib/tenancy'

export async function listOrders(query: SalesOrderQuery, ctx: TenantContext) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const { page, limit, search, status, contact_id, quote_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereAllowedBranches(ctx)
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (quote_id)   where.quote_id   = quote_id
  if (search) {
    where[Op.or as unknown as string] = [
      { order_number: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await SalesOrder.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'order_number', 'status', 'contact_id', 'quote_id',
      'payment_condition', 'currency', 'promised_date', 'delivered_date',
      'subtotal', 'tax_amount', 'total', 'notes', 'created_at',
    ],
    include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] }],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getOrder(id: string, ctx: TenantContext) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const order = await SalesOrder.findByPk(id, {
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: SalesOrderItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.org_id !== ctx.orgId) throw new Error('ORDER_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
    throw new Error('ORDER_NOT_FOUND')
  }
  return order
}

export async function createOrder(input: SalesOrderInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...orderFields } = input
    void whereBranch(ctx, branch_id)
    const order_number = await nextDocumentNumber(ctx.orgId, branch_id, 'order', t)

    const itemTotals = items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
    )
    const docTotals = calcDocumentTotals(itemTotals)

    const order = await SalesOrder.create(
      {
        ...orderFields,
        branch_id,
        order_number,
        org_id:     ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
        ...docTotals,
      },
      { transaction: t },
    )

    await SalesOrderItem.bulkCreate(
      items.map((item, idx) => ({
        order_id:     order.id,
        org_id:       ctx.orgId,
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

    logger.info({ orderId: order.id, order_number, orgId: ctx.orgId, actorId }, 'order created')
    return getOrderInTransaction(order.id, ctx, t)
  })
}

export async function updateOrder(id: string, input: SalesOrderUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await SalesOrder.findOne({ where: { id, org_id: ctx.orgId }, transaction: t })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
      throw new Error('ORDER_NOT_FOUND')
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new Error('ORDER_NOT_EDITABLE')
    }

    const updateData: Record<string, unknown> = { updated_by: actorId }

    if (input.items) {
      const itemTotals = input.items.map(item =>
        calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
      )
      const docTotals = calcDocumentTotals(itemTotals)

      await SalesOrderItem.destroy({ where: { order_id: id }, transaction: t, force: false })

      await SalesOrderItem.bulkCreate(
        input.items.map((item, idx) => ({
          order_id:     id,
          org_id:       order.org_id,
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

      Object.assign(updateData, docTotals)
    }

    const { items: discardedItems, branch_id: discardedBranch, ...rest } = input
    void discardedItems
    void discardedBranch
    await order.update({ ...rest, ...updateData }, { transaction: t })

    logger.info({ orderId: id, actorId }, 'order updated')
    return getOrderInTransaction(id, ctx, t)
  })
}

export async function deleteOrder(id: string, ctx: TenantContext, actorId: string) {
  const order = await SalesOrder.findOne({ where: { id, org_id: ctx.orgId } })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (order.status === 'delivered') throw new Error('ORDER_NOT_DELETABLE')

  await order.update({ deleted_by: actorId })
  await order.destroy()
  logger.info({ orderId: id, actorId }, 'order soft-deleted')
}

export async function convertOrderToInvoice(id: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await SalesOrder.findByPk(id, {
      include: [{ model: SalesOrderItem, as: 'items' }],
      transaction: t,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (order.org_id !== ctx.orgId) throw new Error('ORDER_NOT_FOUND')
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
      throw new Error('ORDER_NOT_FOUND')
    }
    if (order.status !== 'delivered') {
      throw new Error('ORDER_NOT_DELIVERED')
    }
    if (!order.branch_id) throw new Error('ORDER_BRANCH_REQUIRED')

    const invoice_number = await nextDocumentNumber(ctx.orgId, order.branch_id, 'invoice', t)
    const items = (order as SalesOrder & { items: SalesOrderItem[] }).items

    const invoice = await Invoice.create(
      {
        org_id:            ctx.orgId,
        branch_id:         order.branch_id,
        contact_id:        order.contact_id,
        order_id:          order.id,
        price_list_id:     order.price_list_id,
        invoice_number,
        payment_condition: order.payment_condition,
        currency:          order.currency,
        subtotal:          order.subtotal,
        discount_amount:   order.discount_amount,
        tax_amount:        order.tax_amount,
        total:             order.total,
        balance:           order.total,
        notes:             order.notes,
        created_by:        actorId,
        updated_by:        actorId,
      },
      { transaction: t },
    )

    await InvoiceItem.bulkCreate(
      items.map(item => ({
        invoice_id:      invoice.id,
        org_id:          ctx.orgId,
        product_id:      item.product_id,
        description:     item.description,
        quantity:        item.quantity,
        unit_price:      item.unit_price,
        discount_pct:    item.discount_pct,
        iva_rate:        item.iva_rate,
        subtotal:        item.subtotal,
        discount_amount: item.discount_amount,
        tax_base:        item.tax_base,
        tax_amount:      item.tax_amount,
        total:           item.total,
        sort_order:      item.sort_order,
        created_by:      actorId,
        updated_by:      actorId,
      })),
      { transaction: t },
    )

    logger.info({ orderId: id, invoiceId: invoice.id, actorId }, 'order converted to invoice')
    return invoice
  })
}

async function getOrderInTransaction(id: string, ctx: TenantContext, t: import('sequelize').Transaction) {
  ensureSalesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  return SalesOrder.findOne({
    where: whereAllowedBranches(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: SalesOrderItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
    transaction: t,
  })
}
