import 'server-only'
import type { Transaction } from 'sequelize'

/**
 * Provider-agnostic contract for an e-commerce / marketplace integration.
 *
 * The ERP business logic (inventory, catalog, cron, webhooks) talks only to this
 * interface — never to a platform's REST API or data model. Each platform
 * (WooCommerce, Mercado Libre, Tiendanube, Shopify, …) ships one concrete
 * implementation and registers it in the provider registry. Adding a provider is
 * therefore: implement this interface → register it → configure credentials, with
 * no change to ERP business logic (Open/Closed).
 *
 * A `connectionId` identifies one configured connection (for WooCommerce, a
 * `woocommerce_sites` row). The adapter owns its own persistence and credential
 * storage; callers pass ids and receive normalized domain results.
 */
export interface ECommerceAdapter {
  /** Stable registry key, e.g. 'woocommerce'. Matches the URL segment for routes. */
  readonly provider: string

  // --- Connection & auth ---

  /** Verifies stored credentials against the platform with a light authenticated call. */
  testConnection(connectionId: string): Promise<ConnectionTestResult>

  /** (Re)registers the platform-side webhooks the ERP expects to receive. */
  registerWebhooks(connectionId: string): Promise<void>

  // --- Product synchronization (ERP → platform) ---

  /**
   * Transactional fan-out: enqueue a catalog publish for the given ERP variants to
   * every eligible connection in the org. Called from the catalog service inside
   * its transaction (transactional outbox), so it never fires for a rolled-back write.
   */
  enqueueProductSync(orgId: string, variantIds: string[], t?: Transaction): Promise<void>

  /** Publishes a single ERP variant to one connection (create or update). */
  publishProduct(connectionId: string, variantId: string): Promise<void>

  // --- Inventory updates (ERP → platform) ---

  /**
   * Transactional fan-out: enqueue a stock push for a variant to every connection
   * that shares the warehouse a movement just touched. Called from the inventory
   * service inside the movement's transaction.
   */
  enqueueStockSync(variantId: string, warehouseId: string, orgId: string, t: Transaction): Promise<void>

  /** Pushes the current available stock for a variant to one connection. */
  pushStock(connectionId: string, variantId: string): Promise<void>

  // --- Orders (platform → ERP) ---

  /** Fetches one platform order and normalizes it into the common domain model. */
  fetchOrder(connectionId: string, externalOrderId: string): Promise<NormalizedOrder | null>

  /** Imports one platform order into the ERP as a sales order (idempotent). */
  importOrder(connectionId: string, externalOrderId: string): Promise<OrderIngestResult>

  // --- Customer synchronization (bidirectional) ---

  /** Imports platform customers into ERP contacts (idempotent). */
  importCustomers(connectionId: string): Promise<CustomerImportResult>

  /** Pushes ERP customer contacts to the platform (create or update). */
  pushCustomers(connectionId: string): Promise<PushCustomersResult>

  // --- Webhooks / event handling ---

  /** Verifies a webhook delivery's authenticity and enqueues the resulting work. */
  handleWebhook(connectionId: string, rawBody: string, headers: WebhookHeaders): Promise<void>

  // --- Scheduled reconciliation ---

  /** One sync tick for this provider: poll active connections then drain the outbox. */
  runSyncTick(): Promise<SyncTickResult>
}

/** Constructs a provider's adapter. Kept for symmetry with per-connection factories. */
export type ECommerceAdapterFactory = () => ECommerceAdapter

// --- Result shapes (provider-agnostic) ---

export interface ConnectionTestResult {
  ok: boolean
  message?: string
}

export interface SyncTickResult {
  /** Connections polled and external orders queued for ingest. */
  poll: { connections: number; queued: number }
  /** Outbox jobs drained this tick. */
  drain: { processed: number; failed: number }
}

export interface OrderIngestResult {
  connectionId: string
  externalOrderId: string
  /** ERP sales order id, or null when the payload was a status-only change. */
  salesOrderId: string | null
  syncStatus: string
}

export interface CustomerImportResult {
  contacts_created: number
  contacts_linked: number
  already_linked: number
  synced: number
  skipped: number
}

export interface PushCustomersResult {
  created: number
  updated: number
  skipped: number
}

/** Case-insensitive webhook header projection an adapter needs to authenticate a delivery. */
export interface WebhookHeaders {
  signature: string | null
  topic: string | null
}

// --- Normalized domain model ---
// Platform payloads (WooCommerce `WooOrder`, a Shopify order, an ML order, …) are
// mapped onto these neutral shapes at the adapter boundary so nothing above the
// adapter ever sees a platform-specific field name.

export interface NormalizedAddress {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  street?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
}

export interface NormalizedLineItem {
  sku: string | null
  name: string
  quantity: number
  /** Line total after discounts, excluding tax, as a decimal string. */
  total: string
  /** Tax on the line total, as a decimal string. */
  totalTax: string
}

export interface NormalizedOrder {
  externalId: string
  number: string | null
  status: string
  currency: string
  /** UTC instant the order was created on the platform. */
  createdAt: Date | null
  externalCustomerId: string | null
  billing: NormalizedAddress | null
  shipping: NormalizedAddress | null
  lineItems: NormalizedLineItem[]
}

export interface NormalizedCustomer {
  externalId: string
  email: string | null
  firstName?: string | null
  lastName?: string | null
  billing: NormalizedAddress | null
  shipping: NormalizedAddress | null
}

export interface NormalizedProduct {
  externalId: string
  sku: string | null
  name: string
  price: string | null
  manageStock: boolean
  stockQuantity: number | null
}
