import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import SalesQuote from './sales-quote.model'
import SalesQuoteItem from './sales-quote-item.model'
import SalesOrder from './sales-order.model'
import SalesOrderItem from './sales-order-item.model'
import type { SalesQuoteInput, SalesQuoteUpdateInput, SalesQuoteQuery } from './sales-quote.schema'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import { ensureSalesBranchAssociations } from './sales-branch-associations'
import { nextDocumentNumber, calcLineItem, calcDocumentTotals } from './sales.utils'
import type { IvaRate } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches, whereBranch } from '@/lib/tenancy'

export async function listQuotes(query: SalesQuoteQuery, ctx: TenantContext) {
  ensureSalesBranchAssociations()
  const { page, limit, search, status, contact_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereAllowedBranches(ctx)
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (search) {
    where[Op.or as unknown as string] = [
      { quote_number: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await SalesQuote.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'quote_number', 'status', 'contact_id', 'valid_until',
      'payment_condition', 'currency', 'subtotal', 'tax_amount', 'total',
      'notes', 'created_at',
    ],
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getQuote(id: string, ctx: TenantContext) {
  ensureSalesBranchAssociations()
  const quote = await SalesQuote.findByPk(id, {
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: SalesQuoteItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
  })
  if (!quote) throw new Error('QUOTE_NOT_FOUND')
  // Enforce tenant+branch visibility
  if (quote.org_id !== ctx.orgId) throw new Error('QUOTE_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(quote.branch_id as string)) {
    throw new Error('QUOTE_NOT_FOUND')
  }
  return quote
}

export async function createQuote(input: SalesQuoteInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...quoteFields } = input
    void whereBranch(ctx, branch_id)
    const quote_number = await nextDocumentNumber(ctx.orgId, branch_id, 'quote', t)

    const itemTotals = items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
    )
    const docTotals = calcDocumentTotals(itemTotals)

    const quote = await SalesQuote.create(
      {
        ...quoteFields,
        branch_id,
        quote_number,
        org_id:     ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
        ...docTotals,
      },
      { transaction: t },
    )

    await SalesQuoteItem.bulkCreate(
      items.map((item, idx) => ({
        quote_id:   quote.id,
        org_id:     ctx.orgId,
        product_id: item.product_id ?? null,
        description: item.description,
        quantity:   String(item.quantity),
        unit_price: String(item.unit_price),
        discount_pct: String(item.discount_pct ?? 0),
        iva_rate:   (item.iva_rate ?? '21') as IvaRate,
        sort_order: item.sort_order ?? idx,
        created_by: actorId,
        updated_by: actorId,
        ...itemTotals[idx],
      })),
      { transaction: t },
    )

    logger.info({ quoteId: quote.id, quote_number, orgId: ctx.orgId, actorId }, 'quote created')
    return getQuoteInTransaction(quote.id, ctx, t)
  })
}

export async function updateQuote(id: string, input: SalesQuoteUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const quote = await SalesQuote.findOne({ where: { id, org_id: ctx.orgId }, transaction: t })
    if (!quote) throw new Error('QUOTE_NOT_FOUND')
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(quote.branch_id as string)) {
      throw new Error('QUOTE_NOT_FOUND')
    }
    if (quote.status === 'accepted' || quote.status === 'rejected') {
      throw new Error('QUOTE_NOT_EDITABLE')
    }

    const updateData: Record<string, unknown> = { updated_by: actorId }

    if (input.items) {
      const itemTotals = input.items.map(item =>
        calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
      )
      const docTotals = calcDocumentTotals(itemTotals)

      await SalesQuoteItem.destroy({ where: { quote_id: id }, transaction: t, force: false })

      await SalesQuoteItem.bulkCreate(
        input.items.map((item, idx) => ({
          quote_id:     id,
          org_id:       quote.org_id,
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
    await quote.update({ ...rest, ...updateData }, { transaction: t })

    logger.info({ quoteId: id, actorId }, 'quote updated')
    return getQuoteInTransaction(id, ctx, t)
  })
}

export async function deleteQuote(id: string, ctx: TenantContext, actorId: string) {
  const quote = await SalesQuote.findOne({ where: { id, org_id: ctx.orgId } })
  if (!quote) throw new Error('QUOTE_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(quote.branch_id as string)) {
    throw new Error('QUOTE_NOT_FOUND')
  }
  if (quote.status === 'accepted') throw new Error('QUOTE_NOT_DELETABLE')

  await quote.update({ deleted_by: actorId })
  await quote.destroy()
  logger.info({ quoteId: id, actorId }, 'quote soft-deleted')
}

export async function convertQuoteToOrder(id: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const quote = await SalesQuote.findByPk(id, {
      include: [{ model: SalesQuoteItem, as: 'items' }],
      transaction: t,
    })
    if (!quote) throw new Error('QUOTE_NOT_FOUND')
    if (quote.org_id !== ctx.orgId) throw new Error('QUOTE_NOT_FOUND')
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(quote.branch_id as string)) {
      throw new Error('QUOTE_NOT_FOUND')
    }
    if (quote.status !== 'accepted') throw new Error('QUOTE_NOT_ACCEPTED')
    if (!quote.branch_id) throw new Error('QUOTE_BRANCH_REQUIRED')
    if (!quote.contact_id) throw new Error('QUOTE_CONTACT_REQUIRED')

    const order_number = await nextDocumentNumber(ctx.orgId, quote.branch_id, 'order', t)
    const items = (quote as SalesQuote & { items: SalesQuoteItem[] }).items

    const order = await SalesOrder.create(
      {
        org_id:            ctx.orgId,
        branch_id:         quote.branch_id,
        contact_id:        quote.contact_id,
        quote_id:          quote.id,
        price_list_id:     quote.price_list_id,
        order_number,
        payment_condition: quote.payment_condition,
        currency:          quote.currency,
        subtotal:          quote.subtotal,
        discount_amount:   quote.discount_amount,
        tax_amount:        quote.tax_amount,
        total:             quote.total,
        notes:             quote.notes,
        created_by:        actorId,
        updated_by:        actorId,
      },
      { transaction: t },
    )

    await SalesOrderItem.bulkCreate(
      items.map(item => ({
        order_id:       order.id,
        org_id:         ctx.orgId,
        product_id:     item.product_id,
        description:    item.description,
        quantity:       item.quantity,
        unit_price:     item.unit_price,
        discount_pct:   item.discount_pct,
        iva_rate:       item.iva_rate,
        subtotal:       item.subtotal,
        discount_amount: item.discount_amount,
        tax_base:       item.tax_base,
        tax_amount:     item.tax_amount,
        total:          item.total,
        sort_order:     item.sort_order,
        created_by:     actorId,
        updated_by:     actorId,
      })),
      { transaction: t },
    )

    logger.info({ quoteId: id, orderId: order.id, actorId }, 'quote converted to order')
    return order
  })
}

async function getQuoteInTransaction(id: string, ctx: TenantContext, t: import('sequelize').Transaction) {
  ensureSalesBranchAssociations()
  return SalesQuote.findOne({
    where: whereAllowedBranches(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: SalesQuoteItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
    transaction: t,
  })
}
