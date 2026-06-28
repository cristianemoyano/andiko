import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import type { IvaRate } from '@/types'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import { deductStockForOrder, restoreStockForOrder } from '@/modules/inventory/stock-movements.service'
import { createContact } from '@/modules/contacts/contacts.service'
import Contact from '@/modules/contacts/contact.model'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceOrderLink from './woocommerce-order-link.model'
import WoocommerceCustomerLink from './woocommerce-customer-link.model'
import {
  orderToWooCustomer,
  syncWooCustomerToContact,
  upsertContactFromWooCustomer,
} from './woo-customers.service'
import { resolveLiveContactForCustomerLink, resolveLiveSalesOrderForOrderLink } from './woo-sync-links.service'
import {
  isCancelledWooStatus,
  mapWooStatusToErpStatus,
  shouldApplyWooErpStatus,
} from './woo-order-status.utils'
import type { WooOrder, WooAddress } from './woo-client'
import { parseWooOrderCreatedAt } from './woo-client'

/** Tax-inclusive line split (Woo line totals are treated as gross, like POS). */
function calcInclusive(qty: number, grossUnit: Decimal, ivaRate: IvaRate) {
  const quantity = new Decimal(qty)
  const gross = grossUnit.mul(quantity).toDecimalPlaces(2)
  const rate = new Decimal(ivaRate).div(100)
  const taxBase = gross.div(new Decimal(1).add(rate)).toDecimalPlaces(2)
  const taxAmount = gross.sub(taxBase).toDecimalPlaces(2)
  return { subtotal: taxBase.toFixed(2), taxBase: taxBase.toFixed(2), taxAmount: taxAmount.toFixed(2), total: gross.toFixed(2) }
}

function actorFor(site: WoocommerceSite): string {
  return site.created_by ?? site.org_id!
}

function wooOrderCreatedAtPatch(order: WooOrder): { woo_order_created_at?: Date } {
  const parsed = parseWooOrderCreatedAt(order)
  return parsed ? { woo_order_created_at: parsed } : {}
}

function addressFields(prefix: 'shipping' | 'billing', addr: WooAddress | undefined) {
  return {
    [`${prefix}_street`]: addr?.address_1 ?? null,
    [`${prefix}_number`]: null,
    [`${prefix}_floor`]: addr?.address_2 ?? null,
    [`${prefix}_apartment`]: null,
    [`${prefix}_city`]: addr?.city ?? null,
    [`${prefix}_province`]: addr?.state ?? null,
    [`${prefix}_postal_code`]: addr?.postcode ?? null,
    [`${prefix}_country`]: addr?.country ?? null,
  }
}

/** Resolves the ERP contact for a Woo order, creating + linking one as needed. */
async function resolveContact(site: WoocommerceSite, order: WooOrder, t: Transaction): Promise<string | null> {
  const wooCustomerId = order.customer_id
  const customerPayload = orderToWooCustomer(order)

  if (wooCustomerId && wooCustomerId > 0) {
    const existing = await WoocommerceCustomerLink.findOne({
      where: { site_id: site.id, woo_customer_id: String(wooCustomerId) },
      transaction: t,
    })
    if (existing) {
      const contact = await resolveLiveContactForCustomerLink(site, existing, t)
      if (contact) {
        await syncWooCustomerToContact(contact, customerPayload, site, t)
        await existing.update({ last_synced_at: new Date() }, { transaction: t })
        return contact.id
      }
    }

    try {
      const result = await upsertContactFromWooCustomer(site, customerPayload, t)
      return result.contactId
    } catch {
      // Fall through to guest-style resolution when Woo customer has no email on order.
    }
  }

  const b = order.billing
  const email = b?.email?.trim() || null
  const legalName =
    b?.company?.trim() ||
    [b?.first_name, b?.last_name].filter(Boolean).join(' ').trim() ||
    email ||
    `Cliente WooCommerce #${order.id}`

  if (email) {
    const existingByEmail = await Contact.findOne({
      where: { org_id: site.org_id, email },
      attributes: ['id'],
      transaction: t,
    })
    if (existingByEmail) {
      await syncWooCustomerToContact(existingByEmail, customerPayload, site, t)
      if (wooCustomerId && wooCustomerId > 0) {
        await WoocommerceCustomerLink.findOrCreate({
          where: { site_id: site.id, woo_customer_id: String(wooCustomerId) },
          defaults: {
            org_id: site.org_id!,
            site_id: site.id,
            woo_customer_id: String(wooCustomerId),
            contact_id: existingByEmail.id,
            last_synced_at: new Date(),
          },
          transaction: t,
        })
      }
      return existingByEmail.id
    }
  }

  if (!email && (!wooCustomerId || wooCustomerId <= 0) && site.default_contact_id) {
    return site.default_contact_id
  }

  const contact = await createContact(
    {
      type: 'customer',
      legal_name: legalName,
      first_name: b?.first_name ?? null,
      last_name: b?.last_name ?? null,
      iva_condition: 'consumidor_final',
      email: b?.email ?? null,
      phone: b?.phone ?? order.shipping?.phone ?? null,
    },
    { orgId: site.org_id!, userId: actorFor(site), defaultBranchId: site.branch_id, allowedBranchIds: [site.branch_id] },
    actorFor(site),
  )

  await syncWooCustomerToContact(contact, customerPayload, site, t)

  if (wooCustomerId && wooCustomerId > 0) {
    await WoocommerceCustomerLink.create(
      {
        org_id: site.org_id!,
        site_id: site.id,
        woo_customer_id: String(wooCustomerId),
        contact_id: contact.id,
        last_synced_at: new Date(),
      },
      { transaction: t },
    )
  }
  return contact.id
}

async function syncErpOrderStatusFromWoo(
  salesOrderId: string,
  wooStatus: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const target = mapWooStatusToErpStatus(wooStatus)
  const salesOrder = await SalesOrder.findByPk(salesOrderId, {
    attributes: ['id', 'status'],
    transaction: t,
  })
  if (!salesOrder) return
  if (!shouldApplyWooErpStatus(salesOrder.status, target)) return
  if (salesOrder.status !== target) {
    await salesOrder.update({ status: target, updated_by: actorId }, { transaction: t })
  }
}

/**
 * Ingests a WooCommerce order into the ERP as a SalesOrder (source='woocommerce')
 * and deducts stock. Idempotent on (site, woo_order_id): a second call returns the
 * existing link. If stock can't be fully deducted, the order is still created but
 * the link is flagged `needs_review`.
 */
export async function ingestWooOrder(
  siteId: string,
  order: WooOrder,
  opts: { deductStock?: boolean } = {},
): Promise<WoocommerceOrderLink> {
  const deductStock = opts.deductStock ?? true
  const site = await WoocommerceSite.findByPk(siteId)
  if (!site) throw new Error('SITE_NOT_FOUND')

  // Cancelled/refunded/failed payloads are status changes, not new sales.
  if (isCancelledWooStatus(order.status)) {
    return handleOrderCancellation(site, order)
  }

  const existing = await WoocommerceOrderLink.findOne({
    where: { site_id: site.id, woo_order_id: String(order.id) },
  })
  if (existing?.sales_order_id) {
    const liveOrder = await resolveLiveSalesOrderForOrderLink(site.org_id!, existing)
    if (liveOrder) {
      await sequelize.transaction(async (t) => {
        await existing.update(
          { woo_status: order.status, ...wooOrderCreatedAtPatch(order) },
          { transaction: t },
        )
        await syncErpOrderStatusFromWoo(existing.sales_order_id!, order.status, actorFor(site), t)
      })
      return existing
    }
  }

  return sequelize.transaction(async (t) => {
    // Authoritative idempotency guard inside the transaction: claim the
    // (site, woo_order_id) link first. The unique constraint means only one
    // concurrent ingest wins the INSERT; the loser gets created=false and
    // returns without creating a duplicate SalesOrder.
    const [link, created] = await WoocommerceOrderLink.findOrCreate({
      where: { site_id: site.id, woo_order_id: String(order.id) },
      defaults: {
        org_id: site.org_id!,
        site_id: site.id,
        woo_order_id: String(order.id),
        sales_order_id: null,
        woo_status: order.status,
        ...wooOrderCreatedAtPatch(order),
        sync_status: 'pending',
      },
      transaction: t,
    })
    if (!created && link.sales_order_id) {
      const liveOrder = await resolveLiveSalesOrderForOrderLink(site.org_id!, link, t)
      if (liveOrder) {
        await link.update(
          { woo_status: order.status, ...wooOrderCreatedAtPatch(order) },
          { transaction: t },
        )
        await syncErpOrderStatusFromWoo(link.sales_order_id, order.status, actorFor(site), t)
        return link
      }
    }

    const contactId = await resolveContact(site, order, t)
    const orderNumber = await nextDocumentNumber(site.org_id!, site.branch_id, 'order', t)

    let docSubtotal = new Decimal(0)
    let docTax = new Decimal(0)
    let docTotal = new Decimal(0)
    const itemRows: Record<string, unknown>[] = []

    for (const [idx, line] of order.line_items.entries()) {
      const variant = line.sku
        ? await ProductVariant.findOne({ where: { sku: line.sku, org_id: site.org_id }, attributes: ['id', 'product_id'], transaction: t })
        : null
      const product = variant
        ? await Product.findByPk(variant.product_id, { attributes: ['id', 'iva_rate'], transaction: t })
        : null
      const ivaRate = (product?.iva_rate ?? '21') as IvaRate

      const qty = line.quantity
      // Woo stores `total` excluding tax and `total_tax` separately; the gross
      // the customer paid is their sum. We then re-derive IVA from that gross so
      // ERP totals match the storefront regardless of the store's tax settings.
      const grossLine = new Decimal(line.total ?? '0').plus(line.total_tax ?? '0')
      const grossUnit = qty > 0 ? grossLine.div(qty) : new Decimal(0)
      const totals = calcInclusive(qty, grossUnit, ivaRate)

      docSubtotal = docSubtotal.add(totals.subtotal)
      docTax = docTax.add(totals.taxAmount)
      docTotal = docTotal.add(totals.total)

      itemRows.push({
        product_id: variant?.product_id ?? null,
        variant_id: variant?.id ?? null,
        description: line.name ?? line.sku ?? 'Item',
        quantity: String(qty),
        unit_price: grossUnit.toFixed(2),
        discount_pct: '0.00',
        iva_rate: ivaRate,
        subtotal: totals.subtotal,
        discount_amount: '0.00',
        tax_base: totals.taxBase,
        tax_amount: totals.taxAmount,
        total: totals.total,
        sort_order: idx,
      })
    }

    const newOrder = await SalesOrder.create(
      {
        org_id: site.org_id,
        branch_id: site.branch_id,
        contact_id: contactId,
        source: 'woocommerce',
        channel_site_id: site.id,
        order_number: orderNumber,
        status: mapWooStatusToErpStatus(order.status),
        payment_condition: 'cash',
        currency: order.currency || 'ARS',
        notes: `WooCommerce ${site.name} · pedido #${order.number ?? order.id}`,
        ...addressFields('shipping', order.shipping),
        ...addressFields('billing', order.billing),
        subtotal: docSubtotal.toFixed(2),
        discount_amount: '0.00',
        tax_amount: docTax.toFixed(2),
        total: docTotal.toFixed(2),
        afip_status: 'not_sent',
      },
      { transaction: t },
    )

    await SalesOrderItem.bulkCreate(
      itemRows.map((row) => ({ ...row, order_id: newOrder.id, org_id: site.org_id })) as never,
      { transaction: t },
    )

    let syncStatus: 'synced' | 'needs_review' = 'synced'
    let errorMessage: string | null = null
    // Backfill of already-fulfilled orders skips deduction (goods already left).
    if (deductStock) {
      try {
        await deductStockForOrder(newOrder.id, site.org_id!, actorFor(site), t)
      } catch (err) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
          syncStatus = 'needs_review'
          errorMessage = 'Stock insuficiente al ingresar el pedido (revisar manualmente).'
          logger.warn({ siteId: site.id, wooOrderId: order.id }, 'woocommerce order needs review: insufficient stock')
        } else {
          throw err
        }
      }
    }

    await link.update(
      {
        sales_order_id: newOrder.id,
        woo_status: order.status,
        ...wooOrderCreatedAtPatch(order),
        sync_status: syncStatus,
        error_message: errorMessage,
        processed_at: new Date(),
      },
      { transaction: t },
    )

    logger.info({ siteId: site.id, wooOrderId: order.id, salesOrderId: newOrder.id, syncStatus }, 'woocommerce order ingested')
    return link
  })
}

/**
 * Handles a cancelled/refunded Woo order: restores ERP stock (once) and marks the
 * sales order cancelled. Idempotent — skips if already cancelled.
 */
export async function handleOrderCancellation(site: WoocommerceSite, order: WooOrder): Promise<WoocommerceOrderLink> {
  const link = await WoocommerceOrderLink.findOne({
    where: { site_id: site.id, woo_order_id: String(order.id) },
  })
  if (!link?.sales_order_id) {
    // Nothing ingested to reverse; record the status for visibility.
    const [created] = await WoocommerceOrderLink.upsert({
      org_id: site.org_id!,
      site_id: site.id,
      woo_order_id: String(order.id),
      sales_order_id: link?.sales_order_id ?? null,
      woo_status: order.status,
      ...wooOrderCreatedAtPatch(order),
      sync_status: 'synced',
      processed_at: new Date(),
    })
    return created
  }

  await sequelize.transaction(async (t) => {
    const salesOrder = await SalesOrder.findByPk(link.sales_order_id!, { attributes: ['id', 'status'], transaction: t })
    if (salesOrder && salesOrder.status !== 'cancelled') {
      await restoreStockForOrder(link.sales_order_id!, site.org_id!, actorFor(site), t)
      await salesOrder.update({ status: 'cancelled', updated_by: actorFor(site) }, { transaction: t })
    }
    await link.update(
      { woo_status: order.status, processed_at: new Date(), ...wooOrderCreatedAtPatch(order) },
      { transaction: t },
    )
  })
  logger.info({ siteId: site.id, wooOrderId: order.id }, 'woocommerce order cancelled/refunded — stock restored')
  return link
}

/** Worker handler for an 'order_ingest' job. */
export async function processOrderIngestJob(site: WoocommerceSite, payload: Record<string, unknown>): Promise<void> {
  const { buildClientForSite } = await import('./woo-sites.service')
  const wooOrderId = Number(payload.woo_order_id)
  if (!Number.isFinite(wooOrderId)) return

  if (payload.topic === 'order.deleted') {
    await handleOrderCancellation(site, { id: wooOrderId, status: 'cancelled', line_items: [] })
    return
  }

  const client = buildClientForSite(site)
  const order = await client.getOrder(wooOrderId)
  await ingestWooOrder(site.id, order)
}
