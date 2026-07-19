import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/catalog/product-variant.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/catalog/product.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./woocommerce-site.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./woo-sites.service', () => ({
  buildClientForSite: vi.fn(),
  getWebhookSecret: vi.fn(),
  registerWebhooks: vi.fn(),
}))
vi.mock('./woo-catalog.service', () => ({ enqueueProductSync: vi.fn(), publishVariant: vi.fn() }))
vi.mock('./woo-stock.service', () => ({ enqueueStockSync: vi.fn(), pushVariantStock: vi.fn() }))
vi.mock('./woo-orders.service', () => ({ ingestWooOrder: vi.fn() }))
vi.mock('./woo-customers.service', () => ({ applyCustomerImport: vi.fn(), pushCustomersForSite: vi.fn() }))
vi.mock('./woo-webhook.service', () => ({ handleWebhook: vi.fn() }))
vi.mock('./woo-sync-worker.service', () => ({ runSyncTick: vi.fn() }))

import { wooCommerceAdapter } from './woocommerce.adapter'
import WoocommerceSite from './woocommerce-site.model'
import { buildClientForSite } from './woo-sites.service'
import { enqueueProductSync } from './woo-catalog.service'
import { enqueueStockSync } from './woo-stock.service'
import { ingestWooOrder } from './woo-orders.service'
import { runSyncTick } from './woo-sync-worker.service'

const tx = {} as never
const site = { id: 'site-1', org_id: 'org-1' }
const wooOrder = {
  id: 77,
  number: 'A-77',
  status: 'processing',
  currency: 'ARS',
  date_created_gmt: '2026-01-02T03:04:05',
  customer_id: 5,
  billing: { first_name: 'Ana', last_name: 'Gómez', address_1: 'Calle 1', city: 'Mendoza', email: 'ana@x.com' },
  shipping: { address_1: 'Calle 2' },
  line_items: [{ sku: 'SKU1', name: 'Widget', quantity: 2, total: '100.00', total_tax: '21.00' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(WoocommerceSite.findByPk as Mock).mockResolvedValue(site)
})

describe('wooCommerceAdapter', () => {
  it('exposes the woocommerce provider key', () => {
    expect(wooCommerceAdapter.provider).toBe('woocommerce')
  })

  it('delegates enqueueProductSync to the catalog service', async () => {
    await wooCommerceAdapter.enqueueProductSync('org-1', ['v1'], tx)
    expect(enqueueProductSync).toHaveBeenCalledWith('org-1', ['v1'], tx)
  })

  it('delegates enqueueStockSync to the stock service', async () => {
    await wooCommerceAdapter.enqueueStockSync('v1', 'w1', 'org-1', tx)
    expect(enqueueStockSync).toHaveBeenCalledWith('v1', 'w1', 'org-1', tx)
  })

  it('maps runSyncTick result into the neutral shape', async () => {
    ;(runSyncTick as Mock).mockResolvedValue({ poll: { sites: 2, queued: 5 }, drain: { processed: 4, failed: 1 } })
    const result = await wooCommerceAdapter.runSyncTick()
    expect(result).toEqual({ poll: { connections: 2, queued: 5 }, drain: { processed: 4, failed: 1 } })
  })

  it('imports an order by fetching then ingesting, returning a neutral result', async () => {
    ;(buildClientForSite as Mock).mockReturnValue({ getOrder: vi.fn().mockResolvedValue(wooOrder) })
    ;(ingestWooOrder as Mock).mockResolvedValue({ sales_order_id: 'so-9', sync_status: 'synced' })

    const result = await wooCommerceAdapter.importOrder('site-1', '77')

    expect(ingestWooOrder).toHaveBeenCalledWith('site-1', wooOrder)
    expect(result).toEqual({ connectionId: 'site-1', externalOrderId: '77', salesOrderId: 'so-9', syncStatus: 'synced' })
  })

  it('normalizes a woo order into the common domain model', async () => {
    ;(buildClientForSite as Mock).mockReturnValue({ getOrder: vi.fn().mockResolvedValue(wooOrder) })

    const normalized = await wooCommerceAdapter.fetchOrder('site-1', '77')

    expect(normalized).toMatchObject({
      externalId: '77',
      number: 'A-77',
      status: 'processing',
      currency: 'ARS',
      externalCustomerId: '5',
      billing: { firstName: 'Ana', lastName: 'Gómez', street: 'Calle 1', city: 'Mendoza', email: 'ana@x.com' },
      lineItems: [{ sku: 'SKU1', name: 'Widget', quantity: 2, total: '100.00', totalTax: '21.00' }],
    })
    expect(normalized?.createdAt?.toISOString()).toBe('2026-01-02T03:04:05.000Z')
  })

  it('reports a healthy connection when the client pings successfully', async () => {
    ;(buildClientForSite as Mock).mockReturnValue({ ping: vi.fn().mockResolvedValue(undefined) })
    expect(await wooCommerceAdapter.testConnection('site-1')).toEqual({ ok: true })
  })

  it('reports an unhealthy connection when the ping fails', async () => {
    ;(buildClientForSite as Mock).mockReturnValue({ ping: vi.fn().mockRejectedValue(new Error('401')) })
    expect(await wooCommerceAdapter.testConnection('site-1')).toEqual({ ok: false, message: '401' })
  })
})
