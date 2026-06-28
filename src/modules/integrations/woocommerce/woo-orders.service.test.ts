import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)({})) } }))

vi.mock('./woocommerce-site.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./woocommerce-order-link.model', () => ({ default: { findOne: vi.fn(), upsert: vi.fn() } }))
vi.mock('./woocommerce-customer-link.model', () => ({ default: { findOne: vi.fn(), create: vi.fn() } }))
vi.mock('@/modules/sales/sales-order.model', () => ({ default: { create: vi.fn(), findByPk: vi.fn() } }))
vi.mock('@/modules/sales/sales-order-item.model', () => ({ default: { bulkCreate: vi.fn() } }))
vi.mock('@/modules/catalog/product-variant.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/catalog/product.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('@/modules/sales/sales.utils', () => ({ nextDocumentNumber: vi.fn().mockResolvedValue('PED-01-0001') }))
vi.mock('@/modules/inventory/stock-movements.service', () => ({
  deductStockForOrder: vi.fn(),
  restoreStockForOrder: vi.fn(),
}))
vi.mock('@/modules/contacts/contacts.service', () => ({ createContact: vi.fn() }))

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
} as never

beforeEach(() => {
  vi.clearAllMocks()
  ;(WoocommerceSite.findByPk as Mock).mockResolvedValue(site)
  ;(ProductVariant.findOne as Mock).mockResolvedValue({ id: 'v1', product_id: 'p1' })
  ;(Product.findByPk as Mock).mockResolvedValue({ id: 'p1', iva_rate: '21' })
  ;(SalesOrder.create as Mock).mockResolvedValue({ id: 'so1' })
  ;(WoocommerceOrderLink.upsert as Mock).mockImplementation(async (vals: unknown) => [vals])
})

describe('ingestWooOrder', () => {
  it('is idempotent: returns the existing link without creating a new order', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue({ sales_order_id: 'so-existing', update: vi.fn() })

    await ingestWooOrder('s1', order)

    expect(sequelize.transaction as Mock).not.toHaveBeenCalled()
    expect(SalesOrder.create).not.toHaveBeenCalled()
  })

  it('creates a woocommerce-sourced order and deducts stock on the happy path', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', order)

    expect(SalesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'woocommerce', channel_site_id: 's1', branch_id: 'b1', contact_id: 'c-default' }),
      expect.anything(),
    )
    expect(deductStockForOrder).toHaveBeenCalled()
    expect(WoocommerceOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'synced', sales_order_id: 'so1', woo_order_id: '100' }),
      expect.anything(),
    )
  })

  it('flags needs_review (but still creates the order) when stock is insufficient', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)
    ;(deductStockForOrder as Mock).mockRejectedValue(new Error('INSUFFICIENT_STOCK'))

    await ingestWooOrder('s1', order)

    expect(SalesOrder.create).toHaveBeenCalled()
    expect(WoocommerceOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'needs_review', sales_order_id: 'so1' }),
      expect.anything(),
    )
  })

  it('skips stock deduction when deductStock is false (completed-order backfill)', async () => {
    ;(WoocommerceOrderLink.findOne as Mock).mockResolvedValue(null)

    await ingestWooOrder('s1', order, { deductStock: false })

    expect(deductStockForOrder).not.toHaveBeenCalled()
    expect(WoocommerceOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'synced' }),
      expect.anything(),
    )
  })
})
