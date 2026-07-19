import 'server-only'
import type { Transaction } from 'sequelize'
import type {
  ECommerceAdapter,
  ConnectionTestResult,
  OrderIngestResult,
  CustomerImportResult,
  PushCustomersResult,
  NormalizedAddress,
  NormalizedOrder,
  SyncTickResult,
  WebhookHeaders,
} from '../core/ecommerce-adapter'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import WoocommerceSite from './woocommerce-site.model'
import {
  buildClientForSite,
  getWebhookSecret,
  registerWebhooks as registerSiteWebhooks,
} from './woo-sites.service'
import { enqueueProductSync, publishVariant } from './woo-catalog.service'
import { enqueueStockSync, pushVariantStock } from './woo-stock.service'
import { ingestWooOrder } from './woo-orders.service'
import { applyCustomerImport, pushCustomersForSite } from './woo-customers.service'
import { handleWebhook } from './woo-webhook.service'
import { runSyncTick } from './woo-sync-worker.service'
import type { WooAddress, WooOrder } from './woo-client'
import { parseWooOrderCreatedAt } from './woo-client'

/** Loads the connection (a WooCommerce site) or throws. */
async function loadSite(connectionId: string): Promise<WoocommerceSite> {
  const site = await WoocommerceSite.findByPk(connectionId)
  if (!site) throw new Error('SITE_NOT_FOUND')
  return site
}

function normalizeWooAddress(addr: WooAddress | undefined): NormalizedAddress | null {
  if (!addr) return null
  return {
    firstName: addr.first_name ?? null,
    lastName: addr.last_name ?? null,
    company: addr.company ?? null,
    street: addr.address_1 ?? null,
    city: addr.city ?? null,
    province: addr.state ?? null,
    postalCode: addr.postcode ?? null,
    country: addr.country ?? null,
    email: addr.email ?? null,
    phone: addr.phone ?? null,
  }
}

/** Maps a WooCommerce order payload onto the neutral domain model. */
function normalizeWooOrder(order: WooOrder): NormalizedOrder {
  return {
    externalId: String(order.id),
    number: order.number ?? null,
    status: order.status,
    currency: order.currency || 'ARS',
    createdAt: parseWooOrderCreatedAt(order),
    externalCustomerId: order.customer_id && order.customer_id > 0 ? String(order.customer_id) : null,
    billing: normalizeWooAddress(order.billing),
    shipping: normalizeWooAddress(order.shipping),
    lineItems: order.line_items.map((li) => ({
      sku: li.sku ?? null,
      name: li.name ?? li.sku ?? 'Item',
      quantity: li.quantity,
      total: li.total ?? '0',
      totalTax: li.total_tax ?? '0',
    })),
  }
}

/**
 * WooCommerce implementation of the generic e-commerce adapter. It owns nothing of
 * the ERP domain — it delegates to the existing WooCommerce services and only
 * normalizes platform payloads into the common domain model at the boundary.
 */
export const wooCommerceAdapter: ECommerceAdapter = {
  provider: 'woocommerce',

  async testConnection(connectionId: string): Promise<ConnectionTestResult> {
    const site = await loadSite(connectionId)
    try {
      await buildClientForSite(site).ping()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  },

  async registerWebhooks(connectionId: string): Promise<void> {
    const site = await loadSite(connectionId)
    const secret = getWebhookSecret(site)
    if (!secret) throw new Error('WEBHOOK_SECRET_MISSING')
    await registerSiteWebhooks(site, secret)
  },

  enqueueProductSync(orgId: string, variantIds: string[], t?: Transaction): Promise<void> {
    return enqueueProductSync(orgId, variantIds, t)
  },

  async publishProduct(connectionId: string, variantId: string): Promise<void> {
    const site = await loadSite(connectionId)
    const variant = await ProductVariant.findOne({ where: { id: variantId, org_id: site.org_id } })
    if (!variant) throw new Error('VARIANT_NOT_FOUND')
    const product = await Product.findByPk(variant.product_id)
    if (!product) throw new Error('PRODUCT_NOT_FOUND')
    await publishVariant(site, variant, product)
  },

  enqueueStockSync(variantId: string, warehouseId: string, orgId: string, t: Transaction): Promise<void> {
    return enqueueStockSync(variantId, warehouseId, orgId, t)
  },

  async pushStock(connectionId: string, variantId: string): Promise<void> {
    const site = await loadSite(connectionId)
    await pushVariantStock(site, variantId)
  },

  async fetchOrder(connectionId: string, externalOrderId: string): Promise<NormalizedOrder | null> {
    const site = await loadSite(connectionId)
    const order = await buildClientForSite(site).getOrder(Number(externalOrderId))
    return order ? normalizeWooOrder(order) : null
  },

  async importOrder(connectionId: string, externalOrderId: string): Promise<OrderIngestResult> {
    const site = await loadSite(connectionId)
    const order = await buildClientForSite(site).getOrder(Number(externalOrderId))
    const link = await ingestWooOrder(site.id, order)
    return {
      connectionId,
      externalOrderId,
      salesOrderId: link.sales_order_id,
      syncStatus: link.sync_status,
    }
  },

  async importCustomers(connectionId: string): Promise<CustomerImportResult> {
    const site = await loadSite(connectionId)
    return applyCustomerImport(site)
  },

  async pushCustomers(connectionId: string): Promise<PushCustomersResult> {
    const site = await loadSite(connectionId)
    return pushCustomersForSite(site)
  },

  handleWebhook(connectionId: string, rawBody: string, headers: WebhookHeaders): Promise<void> {
    return handleWebhook(connectionId, rawBody, headers)
  },

  async runSyncTick(): Promise<SyncTickResult> {
    const { poll, drain } = await runSyncTick()
    return { poll: { connections: poll.sites, queued: poll.queued }, drain }
  },
}
