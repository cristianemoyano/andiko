import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)({})) } }))

vi.mock('./woocommerce-site.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./woocommerce-order-link.model', () => ({ default: { findOne: vi.fn(), findOrCreate: vi.fn() } }))
vi.mock('./woocommerce-customer-link.model', () => ({ default: { findOne: vi.fn(), create: vi.fn() } }))
vi.mock('@/modules/sales/sales-order.model', () => ({ default: { create: vi.fn(), findByPk: vi.fn(), findOne: vi.fn() } }))
vi.mock('@/modules/sales/sales-order-item.model', () => ({ default: { bulkCreate: vi.fn() } }))
vi.mock('@/modules/catalog/product-variant.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/catalog/product.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('@/modules/sales/sales.utils', () => ({ nextDocumentNumber: vi.fn().mockResolvedValue('PED-01-0001') }))
vi.mock('@/modules/inventory/stock-movements.service', () => ({
  deductStockForOrder: vi.fn(),
  restoreStockForOrder: vi.fn(),
}))
vi.mock('@/modules/contacts/contact.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/contacts/contacts.service', () => ({ createContact: vi.fn() }))
vi.mock('./woo-customers.service', () => ({
  orderToWooCustomer: vi.fn((order) => order),
  syncWooCustomerToContact: vi.fn(),
  upsertContactFromWooCustomer: vi.fn(),
}))
vi.mock('./woo-sync-links.service', () => ({
  resolveLiveContactForCustomerLink: vi.fn(),
  resolveLiveSalesOrderForOrderLink: vi.fn(async (_orgId: string, link: { sales_order_id?: string | null }) => {
    if (!link.sales_order_id) return null
    return { id: link.sales_order_id, deleted_at: null }
  }),
}))

import sequelize from '@/lib/db'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceOrderLink from './woocommerce-order-link.model'
import SalesOrder from './../../sales/sales-order.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import { deductStockForOrder } from '@/modules/inventory/stock-movements.service'
import { ingestWooOrder } from './woo-orders.service'

const site = { id: 's1', org_id: 'o1', branch_id: 'b1', name: 'Tienda', default_contact_id: 'c-default', created_by: 'u1' }

const order = {
  id: 100,
  status: 'processing',
  currency: 'ARS',
  customer_id: 0,
  line_items: [{ sku: 'SKU1', name: 'Producto', quantity: 2, total: '242.00' }],
  billing: {},
  shipping: {},
}

// Shared link instance whose .update we assert on (set fresh per test).
let linkInstance: { update: Mock; sales_order_id?: string | null }

beforeEach(() => {
  vi.clearAllMocks()
  linkInstance = { update: vi.fn() }
  ;(WoocommerceSite.findByPk as Mock).mockResolvedValue(site)
  ;(ProductVariant.findOne as Mock).mockResolvedValue({ id: 'v1', product_id: 'p1' })
  ;(Product.findByPk as Mock).mockResolvedValue({ id: 'p1', iva_rate: '21' })
  ;(SalesOrder.create as Mock).mockResolvedValue({ id: 'so1' })
  // Default: we win the idempotency race (created = true).
  ;(WoocommerceOrderLink.findOrCreate as Mock).mockResolvedValue([linkInstance, true])
})

describe('ingestWooOrder', () => {
  it('is idempotent: returns the existing link without creating a new order', async () => {
    const linkUpdate = vi.fn()
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue({
      site_id: 's1',
      sales_order_id: 'so-existing',
      update: linkUpdate,
    })
    ;(SalesOrder.findByPk as Mock).mockResolvedValue({ id: 'so-existing', status: 'confirmed', update: vi.fn() })

    await ingestWooOrder('s1', order)

    expect(sequelize.transaction).toHaveBeenCalled()
    expect(SalesOrder.create).not.toHaveBeenCalled()
    expect(linkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ woo_status: 'processing' }),
      expect.anything(),
    )
  })

  it('maps completed Woo orders to delivered ERP status on create', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', { ...order, status: 'completed' }, { deductStock: false })

    expect(SalesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered' }),
      expect.anything(),
    )
  })

  it('creates a woocommerce-sourced order and deducts stock on the happy path', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', order)

    expect(SalesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'woocommerce',
        channel_site_id: 's1',
        branch_id: 'b1',
        contact_id: 'c-default',
        status: 'in_progress',
      }),
      expect.anything(),
    )
    expect(deductStockForOrder).toHaveBeenCalled()
    expect(linkInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'synced', sales_order_id: 'so1' }),
      expect.anything(),
    )
  })

  it('resumes ingest when link exists but sales_order_id is still null', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)
    linkInstance.sales_order_id = null
    ;(WoocommerceOrderLink.findOrCreate as Mock).mockResolvedValue([linkInstance, false])

    await ingestWooOrder('s1', order)

    expect(SalesOrder.create).toHaveBeenCalled()
    expect(deductStockForOrder).toHaveBeenCalled()
  })

  it('flags needs_review (but still creates the order) when stock is insufficient', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)
    ;(deductStockForOrder as Mock).mockRejectedValue(new Error('INSUFFICIENT_STOCK'))

    await ingestWooOrder('s1', order)

    expect(SalesOrder.create).toHaveBeenCalled()
    expect(linkInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'needs_review', sales_order_id: 'so1' }),
      expect.anything(),
    )
  })

  it('stores Woo date_created_gmt (UTC) on the order link', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', {
      ...order,
      date_created: '2026-06-28T15:29:00',
      date_created_gmt: '2026-06-28T18:29:00',
    })

    expect(WoocommerceOrderLink.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: expect.objectContaining({
          woo_order_created_at: new Date('2026-06-28T18:29:00Z'),
        }),
      }),
    )
    expect(linkInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        woo_order_created_at: new Date('2026-06-28T18:29:00Z'),
      }),
      expect.anything(),
    )
  })

  it('does not store woo_order_created_at when date_created_gmt is missing', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', { ...order, date_created: '2026-06-28T15:29:00' })

    const findOrCreateCall = (WoocommerceOrderLink.findOrCreate as Mock).mock.calls[0][0]
    expect(findOrCreateCall.defaults.woo_order_created_at).toBeUndefined()
    expect(linkInstance.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ woo_order_created_at: expect.anything() }),
      expect.anything(),
    )
  })

  it('skips stock deduction when deductStock is false (completed-order backfill)', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', order, { deductStock: false })

    expect(deductStockForOrder).not.toHaveBeenCalled()
    expect(linkInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'synced' }),
      expect.anything(),
    )
  })
})
