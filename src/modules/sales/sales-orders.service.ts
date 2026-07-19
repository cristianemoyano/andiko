import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import SalesOrder from './sales-order.model'
import SalesOrderItem from './sales-order-item.model'
import Invoice from './invoice.model'
import InvoiceItem from './invoice-item.model'
import Payment from './payment.model'
import type { SalesOrderInput, SalesOrderUpdateInput, SalesOrderQuery, SalesOrderStatusCountsQuery } from './sales-order.schema'
import type { OrderBillInput } from './order-bill.schema'
import { recalcInvoiceBalance } from './invoices.service'
import { postInvoiceIssuedAccounting } from '@/modules/accounting/sales-invoice-accounting.service'
import { resolveVariantUnitCosts, snapshotUnitCost } from './invoice-item-cost'
import { postSalesPaymentAccounting } from '@/modules/accounting/sales-payment-accounting.service'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import User from '@/modules/auth/user.model'
import { ensureSalesBranchAssociations } from './sales-branch-associations'
import { buildBranchRenumberPatch, assertDraftBranchChange, DOCUMENT_BRANCH_NOT_CHANGEABLE } from '@/lib/branch-document-renumber'
import { nextDocumentNumber, calcLineItem, calcDocumentTotals, computeInvoiceDueDate } from './sales.utils'
import { isOrderInvoiceable } from './sales-order-workflow'
import type { IvaRate, PaymentCondition } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches, whereBranch } from '@/lib/tenancy'
import { isWithinSalesOwnScope, whereSalesDocumentScope, whereSalesOwnScope } from './sales-scope'
import { atEndOfDay, atStartOfDay } from '@/lib/date-only'
import { combineListWhere, wooOrderStatusListWhere } from '@/modules/integrations/woocommerce/woo-list-filters'
import {
  getWooOrderChannelForSalesOrder,
  getWooOrderChannelSummariesForSalesOrders,
} from '@/modules/integrations/woocommerce/woo-order-channel.utils'
import { assertSaleLineItemsFromActiveCatalog } from './sales-line-items.validation'
import { assertSaleLineItemsHaveBranchStock } from './sales-line-stock.service'
import { loadProductTypesById } from './order-item-product-types'
import type { OrderStatus } from './sales-order.model'

type OrdersListFilterQuery = Pick<
  SalesOrderQuery,
  'search' | 'status' | 'statuses' | 'contact_id' | 'quote_id' | 'source' | 'woo_status' | 'branch_id' | 'from' | 'to'
>

function buildOrdersListWhere(query: OrdersListFilterQuery, ctx: TenantContext) {
  const { search, status, statuses, contact_id, quote_id, source, woo_status, branch_id, from, to } = query

  const createdAtWhere =
    from || to
      ? {
          created_at: {
            ...(from ? { [Op.gte]: atStartOfDay(from) } : {}),
            ...(to ? { [Op.lte]: atEndOfDay(to) } : {}),
          },
        }
      : {}

  const statusWhere = statuses?.length
    ? { status: { [Op.in]: statuses } }
    : status
      ? { status }
      : {}

  return combineListWhere(
    whereAllowedBranches(ctx),
    whereSalesOwnScope(ctx),
    branch_id ? { branch_id } : {},
    createdAtWhere,
    statusWhere,
    woo_status ? wooOrderStatusListWhere(ctx.orgId, woo_status) : {},
    contact_id ? { contact_id } : {},
    quote_id ? { quote_id } : {},
    source ? { source } : {},
    search ? { [Op.or]: [{ order_number: { [Op.iLike]: `%${search}%` } }] } : {},
  )
}

export async function listOrders(query: SalesOrderQuery, ctx: TenantContext) {
  ensureSalesBranchAssociations()

  const { page, limit } = query
  const { offset } = paginate(page, limit)
  const where = buildOrdersListWhere(query, ctx)

  const { rows, count } = await SalesOrder.findAndCountAll({
    where,
    limit,
    offset,
    order: [['updated_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'order_number', 'status', 'source', 'contact_id', 'quote_id', 'salesperson_id',
      'payment_condition', 'currency', 'promised_date', 'delivered_date',
      'shipping_street', 'shipping_number', 'shipping_floor', 'shipping_apartment', 'shipping_city', 'shipping_province', 'shipping_postal_code', 'shipping_country',
      'billing_street', 'billing_number', 'billing_floor', 'billing_apartment', 'billing_city', 'billing_province', 'billing_postal_code', 'billing_country',
      'subtotal', 'tax_amount', 'total', 'notes', 'created_at', 'updated_at',
    ],
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'email'], required: false },
      { model: User, as: 'salesperson', attributes: ['id', 'name'] },
    ],
  })

  const wooOrderIds = rows.filter((row) => row.source === 'woocommerce').map((row) => row.id)
  const wooChannels = await getWooOrderChannelSummariesForSalesOrders(wooOrderIds, ctx.orgId)

  const data = rows.map((row) => {
    const json = row.get({ plain: true }) as unknown as Record<string, unknown>
    if (row.source === 'woocommerce') {
      json.woo_channel = wooChannels.get(row.id) ?? null
    }
    return json
  })

  return toPaginated(data, count, page, limit)
}

export async function getOrderStatusCounts(query: SalesOrderStatusCountsQuery, ctx: TenantContext) {
  ensureSalesBranchAssociations()

  const where = buildOrdersListWhere(query, ctx)
  const rows = await SalesOrder.findAll({
    where,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('SalesOrder.id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  }) as unknown as Array<{ status: OrderStatus; count: string }>

  const byStatus = Object.fromEntries(
    rows.map(row => [row.status, Number(row.count)]),
  ) as Partial<Record<OrderStatus, number>>

  const partialReturned = byStatus.partial_returned ?? 0
  const returned = byStatus.returned ?? 0

  return {
    '': Object.values(byStatus).reduce((sum, n) => sum + n, 0),
    draft:            byStatus.draft ?? 0,
    confirmed:        byStatus.confirmed ?? 0,
    in_progress:      byStatus.in_progress ?? 0,
    delivered:        byStatus.delivered ?? 0,
    returns:          partialReturned + returned,
    cancelled:        byStatus.cancelled ?? 0,
  }
}

export async function getOrder(id: string, ctx: TenantContext) {
  ensureSalesBranchAssociations()

  const order = await SalesOrder.findByPk(id, {
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'email'], required: false },
      { model: User, as: 'salesperson', attributes: ['id', 'name'] },
      { model: SalesOrderItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.org_id !== ctx.orgId) throw new Error('ORDER_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (!isWithinSalesOwnScope(ctx, order)) throw new Error('ORDER_NOT_FOUND')
  return serializeSalesOrderDetail(order, ctx.orgId)
}

async function serializeSalesOrderDetail(order: SalesOrder, orgId: string) {
  const json = order.get({ plain: true }) as unknown as Record<string, unknown>
  const items = json.items
  if (Array.isArray(items)) {
    const productIds = items
      .map(item => (item as { product_id?: string | null }).product_id)
      .filter((id): id is string => Boolean(id))
    const productTypes = await loadProductTypesById(productIds, orgId)
    json.items = items.map(item => {
      const row = item as { product_id?: string | null }
      return {
        ...row,
        product_type: row.product_id ? productTypes.get(row.product_id) ?? null : null,
      }
    })
  }
  if (order.source === 'woocommerce') {
    json.woo_channel = await getWooOrderChannelForSalesOrder(order.id, orgId, order.channel_site_id)
  }
  return json
}

export async function createOrder(input: SalesOrderInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...orderFields } = input
    await assertSaleLineItemsFromActiveCatalog(items, ctx.orgId, t)
    await assertSaleLineItemsHaveBranchStock(
      items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
      branch_id,
      ctx.orgId,
      t,
    )
    void whereBranch(ctx, branch_id)
    const order_number = await nextDocumentNumber(ctx.orgId, branch_id, 'order', t)

    // Campañas activas (guardado por módulo; reutiliza discount_pct por línea, no toca totales).
    const { resolveCampaignsForSaleItems } = await import('@/modules/campaigns/sales-integration')
    const orderMeta = orderFields as { contact_id?: string | null; source?: 'erp' | 'pos' | 'woocommerce'; payment_condition?: PaymentCondition }
    const campaignRes = await resolveCampaignsForSaleItems(
      items,
      {
        branch_id: branch_id ?? null,
        contact_id: orderMeta.contact_id ?? null,
        source: orderMeta.source,
        payment_condition: orderMeta.payment_condition ?? null,
      },
      ctx.orgId,
    )
    const discountFor = (idx: number, item: { discount_pct?: string | number | null }) =>
      campaignRes?.discountPctByIndex[idx] ?? String(item.discount_pct ?? 0)

    const itemTotals = items.map((item, idx) =>
      calcLineItem(item.quantity, item.unit_price, discountFor(idx, item), (item.iva_rate ?? '21') as IvaRate)
    )
    const docTotals = calcDocumentTotals(itemTotals)

    const order = await SalesOrder.create(
      {
        ...orderFields,
        branch_id,
        order_number,
        salesperson_id: actorId,
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
        product_id:   item.product_id,
        variant_id:   item.variant_id,
        description:  item.description,
        quantity:     String(item.quantity),
        unit_price:   String(item.unit_price),
        discount_pct: discountFor(idx, item),
        iva_rate:     (item.iva_rate ?? '21') as IvaRate,
        sort_order:   item.sort_order ?? idx,
        created_by:   actorId,
        updated_by:   actorId,
        ...itemTotals[idx],
      })),
      { transaction: t },
    )

    if (campaignRes) {
      const { commitCampaignApplications } = await import('@/modules/campaigns/sales-integration')
      await commitCampaignApplications(
        campaignRes.result,
        { type: 'sales_order', id: order.id, contactId: order.contact_id },
        ctx.orgId,
        actorId,
        t,
      )
    }

    logger.info({ orderId: order.id, order_number, orgId: ctx.orgId, actorId }, 'order created')
    return getOrderInTransaction(order.id, ctx, t)
  })
}

const CONTACT_ASSIGNMENT_FIELDS = [
  'contact_id',
  'shipping_street', 'shipping_number', 'shipping_floor', 'shipping_apartment',
  'shipping_city', 'shipping_province', 'shipping_postal_code', 'shipping_country',
  'billing_street', 'billing_number', 'billing_floor', 'billing_apartment',
  'billing_city', 'billing_province', 'billing_postal_code', 'billing_country',
] as const satisfies ReadonlyArray<keyof SalesOrderUpdateInput>

const LOCKED_ORDER_PATCH_FIELDS = new Set([
  'items', 'status', 'branch_id', 'price_list_id', 'promised_date', 'payment_condition',
  'notes', 'internal_notes', 'delivered_date', 'quote_id', 'currency',
])

function isContactAssignmentPayload(submittedKeys: string[]): boolean {
  if (!submittedKeys.includes('contact_id')) return false
  return submittedKeys.every(key => !LOCKED_ORDER_PATCH_FIELDS.has(key))
}

function canAssignMissingContact(
  order: SalesOrder,
  input: SalesOrderUpdateInput,
  submittedKeys: string[],
): boolean {
  if (order.status === 'cancelled') return false
  if (order.contact_id) return false
  if (!input.contact_id) return false
  return isContactAssignmentPayload(submittedKeys)
}

function pickContactAssignmentFields(input: SalesOrderUpdateInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of CONTACT_ASSIGNMENT_FIELDS) {
    if (input[key] !== undefined) patch[key] = input[key]
  }
  return patch
}

async function syncContactToUnassignedInvoices(
  orderId: string,
  orgId: string,
  contactId: string,
  actorId: string,
  t: import('sequelize').Transaction,
) {
  await Invoice.update(
    { contact_id: contactId, updated_by: actorId },
    {
      where: {
        order_id: orderId,
        org_id: orgId,
        contact_id: null,
        afip_status: { [Op.ne]: 'authorized' },
      },
      transaction: t,
    },
  )
}

export async function updateOrder(
  id: string,
  input: SalesOrderUpdateInput,
  ctx: TenantContext,
  actorId: string,
  submittedKeys?: string[],
) {
  const patchKeys = submittedKeys ?? Object.keys(input).filter(
    key => input[key as keyof SalesOrderUpdateInput] !== undefined,
  )

  let stockDeducted = false

  const result = await sequelize.transaction(async (t) => {
    const order = await SalesOrder.findOne({ where: { id, org_id: ctx.orgId }, transaction: t })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
      throw new Error('ORDER_NOT_FOUND')
    }

    const isLocked = order.status === 'delivered' || order.status === 'cancelled'
    if (isLocked) {
      if (!canAssignMissingContact(order, input, patchKeys)) {
        throw new Error('ORDER_NOT_EDITABLE')
      }

      const patch = pickContactAssignmentFields(input)
      await order.update({ ...patch, updated_by: actorId }, { transaction: t })
      await syncContactToUnassignedInvoices(id, ctx.orgId, input.contact_id!, actorId, t)
      logger.info({ orderId: id, contactId: input.contact_id, actorId }, 'order contact assigned on locked order')
      return getOrderInTransaction(id, ctx, t)
    }

    const prevStatus = order.status
    const updateData: Record<string, unknown> = { updated_by: actorId }

    if (input.items) {
      await assertSaleLineItemsFromActiveCatalog(input.items, order.org_id!, t)
      const branchIdForStock = (input.branch_id ?? order.branch_id) as string
      await assertSaleLineItemsHaveBranchStock(
        input.items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        branchIdForStock,
        order.org_id!,
        t,
      )
      const itemTotals = input.items.map(item =>
        calcLineItem(item.quantity, item.unit_price, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate)
      )
      const docTotals = calcDocumentTotals(itemTotals)

      await SalesOrderItem.destroy({ where: { order_id: id }, transaction: t, force: false })

      await SalesOrderItem.bulkCreate(
        input.items.map((item, idx) => ({
          order_id:     id,
          org_id:       order.org_id,
          product_id:   item.product_id,
          variant_id:   item.variant_id,
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

    const { items: discardedItems, branch_id: nextBranchId, delivery_logistics, ...rest } = input
    void discardedItems

    if (nextBranchId && nextBranchId !== order.branch_id) {
      if (order.source === 'pos') throw new Error(DOCUMENT_BRANCH_NOT_CHANGEABLE)
      assertDraftBranchChange(order.status)
      void whereBranch(ctx, nextBranchId)
      Object.assign(updateData, await buildBranchRenumberPatch({
        orgId: ctx.orgId!,
        currentBranchId: order.branch_id,
        nextBranchId,
        numberField: 'order_number',
        resolveNextNumber: (orgId, branchId, tx) => nextDocumentNumber(orgId, branchId, 'order', tx),
        t,
      }))
    }

    let deliveredAt: Date | null = null
    if (rest.status === 'delivered' && prevStatus !== 'delivered') {
      deliveredAt = (rest.delivered_date as Date | undefined) ?? order.delivered_date ?? new Date()
      if (!order.delivered_date && !rest.delivered_date) {
        updateData.delivered_date = deliveredAt
      }
    }

    await order.update({ ...rest, ...updateData }, { transaction: t })

    if (deliveredAt && delivery_logistics === 'close_open_shipments') {
      const { closeOpenShipmentsWhenOrderDelivered } = await import('@/modules/logistics/shipments.service')
      await closeOpenShipmentsWhenOrderDelivered(id, ctx.orgId, actorId, deliveredAt, t)
    }

    const effectiveBranchId = (input.branch_id ?? order.branch_id) as string

    // Stock hooks: deduct when confirmed, restore when cancelled from confirmed
    if (input.status === 'confirmed' && prevStatus !== 'confirmed') {
      if (!input.items) {
        const currentItems = await SalesOrderItem.findAll({
          where: { order_id: id },
          attributes: ['variant_id', 'quantity'],
          transaction: t,
        })
        await assertSaleLineItemsHaveBranchStock(
          currentItems.map((item) => ({
            variant_id: item.variant_id as string,
            quantity: Number(item.quantity),
          })),
          effectiveBranchId,
          ctx.orgId,
          t,
        )
      }
      const { deductStockForOrder } = await import('@/modules/inventory/stock-movements.service')
      await deductStockForOrder(id, ctx.orgId, actorId, t)
      stockDeducted = true
    } else if (input.status === 'cancelled' && prevStatus === 'confirmed') {
      const { restoreStockForOrder } = await import('@/modules/inventory/stock-movements.service')
      await restoreStockForOrder(id, ctx.orgId, actorId, t)
    }

    logger.info({ orderId: id, actorId }, 'order updated')
    return getOrderInTransaction(id, ctx, t)
  })

  // Non-blocking: drain any low-stock alerts queued by this confirmation, in
  // real time rather than waiting for the automations safety-net sweep.
  if (stockDeducted) {
    try {
      const { drainPendingLowStockAlerts } = await import('@/modules/inventory/low-stock-alert.service')
      await drainPendingLowStockAlerts(ctx.orgId)
    } catch (err) {
      logger.error({ err, orderId: id, orgId: ctx.orgId }, 'low stock alert drain failed')
    }
  }

  return result
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
  return billOrder(id, { mode: 'draft' }, ctx, actorId)
}

async function assertOrderReadyToBill(
  order: SalesOrder & { items?: SalesOrderItem[] },
  ctx: TenantContext,
  t: Transaction,
): Promise<SalesOrder & { items: SalesOrderItem[] }> {
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.org_id !== ctx.orgId) throw new Error('ORDER_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && order.branch_id && !ctx.allowedBranchIds.includes(order.branch_id as string)) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (!isOrderInvoiceable(order.status)) throw new Error('ORDER_NOT_INVOICEABLE')
  if (!order.branch_id) throw new Error('ORDER_BRANCH_REQUIRED')
  if (!order.contact_id) throw new Error('ORDER_CONTACT_REQUIRED')

  const existingInvoice = await Invoice.findOne({
    where: { order_id: order.id, org_id: ctx.orgId },
    attributes: ['id'],
    transaction: t,
  })
  if (existingInvoice) {
    const err = new Error('ORDER_ALREADY_INVOICED') as Error & { invoiceId: string }
    err.invoiceId = existingInvoice.id as string
    throw err
  }

  let items = order.items
  if (!items) {
    items = await SalesOrderItem.findAll({ where: { order_id: order.id }, transaction: t })
  }
  return Object.assign(order, { items })
}

async function createInvoiceFromOrderInTx(
  order: SalesOrder & { items: SalesOrderItem[] },
  ctx: TenantContext,
  actorId: string,
  t: Transaction,
): Promise<Invoice> {
  const invoice_number = await nextDocumentNumber(ctx.orgId, order.branch_id as string, 'invoice', t)

  const invoice = await Invoice.create(
    {
      org_id:            ctx.orgId,
      branch_id:         order.branch_id,
      contact_id:        order.contact_id,
      order_id:          order.id,
      price_list_id:     order.price_list_id,
      invoice_number,
      salesperson_id:    actorId,
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

  const costByVariant = await resolveVariantUnitCosts(order.items.map(i => i.variant_id), ctx.orgId, t)

  await InvoiceItem.bulkCreate(
    order.items.map(item => ({
      invoice_id:      invoice.id,
      org_id:          ctx.orgId,
      product_id:      item.product_id,
      variant_id:      item.variant_id,
      description:     item.description,
      quantity:        item.quantity,
      unit_price:      item.unit_price,
      unit_cost:       snapshotUnitCost(item.variant_id, costByVariant),
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

  return invoice
}

/**
 * Factura un pedido con el modo que corresponda al negocio:
 * borrador, emitida a cuenta, o emitida con cobro (anticipo / contado / contra entrega ya cobrado).
 * No exige pago previo ni entrega — es independiente de logística.
 */
export async function billOrder(id: string, input: OrderBillInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await SalesOrder.findByPk(id, {
      include: [{ model: SalesOrderItem, as: 'items' }],
      transaction: t,
    })
    const ready = await assertOrderReadyToBill(order as SalesOrder & { items?: SalesOrderItem[] }, ctx, t)
    const invoice = await createInvoiceFromOrderInTx(ready, ctx, actorId, t)

    if (input.mode !== 'draft') {
      const issue_date = input.payment?.payment_date ?? new Date()
      const due_date = computeInvoiceDueDate(issue_date, ready.payment_condition)
      await invoice.update(
        { status: 'issued', issue_date, due_date, updated_by: actorId },
        { transaction: t },
      )
      await postInvoiceIssuedAccounting(invoice.id, ctx, t)
    }

    if (input.mode === 'issue_and_collect') {
      const payment = input.payment!
      const amount = payment.amount ?? new Decimal(ready.total).toNumber()
      const payment_number = await nextDocumentNumber(ctx.orgId, ready.branch_id as string, 'payment', t)
      const createdPayment = await Payment.create(
        {
          org_id:         ctx.orgId,
          branch_id:      ready.branch_id,
          invoice_id:     invoice.id,
          contact_id:     ready.contact_id,
          salesperson_id: actorId,
          payment_number,
          payment_date:   payment.payment_date ?? new Date(),
          amount:         String(amount),
          payment_method: payment.payment_method,
          reference:      payment.reference ?? null,
          notes:          payment.notes ?? null,
          created_by:     actorId,
          updated_by:     actorId,
        },
        { transaction: t },
      )
      await recalcInvoiceBalance(invoice.id, t)
      await postSalesPaymentAccounting(createdPayment.id, ctx, t)
    }

    logger.info({ orderId: id, invoiceId: invoice.id, mode: input.mode, actorId }, 'order billed')
    return invoice.reload({ transaction: t })
  })
}

async function getOrderInTransaction(id: string, ctx: TenantContext, t: import('sequelize').Transaction) {
  ensureSalesBranchAssociations()

  return SalesOrder.findOne({
    where: whereSalesDocumentScope(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'email'], required: false },
      { model: SalesOrderItem, as: 'items', order: [['sort_order', 'ASC']] },
    ],
    transaction: t,
  })
}
