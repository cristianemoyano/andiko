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
import { nextDocumentNumber, calcLineItem, calcDocumentTotals } from './sales.utils'
import type { IvaRate } from '@/types'

export async function listQuotes(query: SalesQuoteQuery) {
  const { page, limit, search, status, contact_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
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
      'id', 'quote_number', 'status', 'contact_id', 'valid_until',
      'payment_condition', 'currency', 'subtotal', 'tax_amount', 'total',
      'notes', 'created_at',
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getQuote(id: string) {
  const quote = await SalesQuote.findByPk(id, {
    include: [{ model: SalesQuoteItem, as: 'items', order: [['sort_order', 'ASC']] }],
  })
  if (!quote) throw new Error('QUOTE_NOT_FOUND')
  return quote
}

export async function createQuote(input: SalesQuoteInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const quote_number = await nextDocumentNumber(orgId, 'quote', t)

    const itemTotals = input.items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
    )
    const docTotals = calcDocumentTotals(itemTotals)

    const quote = await SalesQuote.create(
      {
        ...input,
        quote_number,
        org_id:     orgId,
        created_by: actorId,
        updated_by: actorId,
        ...docTotals,
      },
      { transaction: t },
    )

    await SalesQuoteItem.bulkCreate(
      input.items.map((item, idx) => ({
        quote_id:   quote.id,
        org_id:     orgId,
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

    logger.info({ quoteId: quote.id, quote_number, orgId, actorId }, 'quote created')
    return getQuoteInTransaction(quote.id, t)
  })
}

export async function updateQuote(id: string, input: SalesQuoteUpdateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const quote = await SalesQuote.findByPk(id, { transaction: t })
    if (!quote) throw new Error('QUOTE_NOT_FOUND')
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

    const { items: _items, ...rest } = input
    await quote.update({ ...rest, ...updateData }, { transaction: t })

    logger.info({ quoteId: id, actorId }, 'quote updated')
    return getQuoteInTransaction(id, t)
  })
}

export async function deleteQuote(id: string, actorId: string) {
  const quote = await SalesQuote.findByPk(id)
  if (!quote) throw new Error('QUOTE_NOT_FOUND')
  if (quote.status === 'accepted') throw new Error('QUOTE_NOT_DELETABLE')

  await quote.update({ deleted_by: actorId })
  await quote.destroy()
  logger.info({ quoteId: id, actorId }, 'quote soft-deleted')
}

export async function convertQuoteToOrder(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const quote = await SalesQuote.findByPk(id, {
      include: [{ model: SalesQuoteItem, as: 'items' }],
      transaction: t,
    })
    if (!quote) throw new Error('QUOTE_NOT_FOUND')
    if (quote.status !== 'accepted') throw new Error('QUOTE_NOT_ACCEPTED')

    const order_number = await nextDocumentNumber(orgId, 'order', t)
    const items = (quote as SalesQuote & { items: SalesQuoteItem[] }).items

    const order = await SalesOrder.create(
      {
        org_id:           orgId,
        branch_id:        quote.branch_id,
        contact_id:       quote.contact_id,
        quote_id:         quote.id,
        order_number,
        payment_condition: quote.payment_condition,
        currency:         quote.currency,
        subtotal:         quote.subtotal,
        discount_amount:  quote.discount_amount,
        tax_amount:       quote.tax_amount,
        total:            quote.total,
        notes:            quote.notes,
        created_by:       actorId,
        updated_by:       actorId,
      },
      { transaction: t },
    )

    await SalesOrderItem.bulkCreate(
      items.map(item => ({
        order_id:       order.id,
        org_id:         orgId,
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

async function getQuoteInTransaction(id: string, t: import('sequelize').Transaction) {
  return SalesQuote.findByPk(id, {
    include: [{ model: SalesQuoteItem, as: 'items', order: [['sort_order', 'ASC']] }],
    transaction: t,
  })
}
