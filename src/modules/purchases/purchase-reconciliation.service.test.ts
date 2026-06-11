import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('./purchase-order.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn() },
}))
vi.mock('./purchase-order-item.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./purchase-receipt.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./purchase-receipt-item.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./supplier-invoice.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./supplier-invoice-item.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./purchases-branch-associations', () => ({
  ensurePurchasesBranchAssociations: vi.fn(),
}))
vi.mock('@/modules/contacts/contact.model', () => ({
  default: { belongsTo: vi.fn(), hasMany: vi.fn() },
}))
vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn() },
}))

import PurchaseOrder from './purchase-order.model'
import PurchaseOrderItem from './purchase-order-item.model'
import PurchaseReceipt from './purchase-receipt.model'
import SupplierInvoice from './supplier-invoice.model'
import {
  reconcileOrderLines,
  listReconciliation,
  type OrderedLineInput,
  type ReceivedLineInput,
  type InvoicedLineInput,
} from './purchase-reconciliation.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

const orderedLine = (overrides: Partial<OrderedLineInput> = {}): OrderedLineInput => ({
  id: 'poi-1',
  product_id: 'prod-1',
  variant_id: null,
  description: 'Tornillo 8mm',
  quantity: '10',
  unit_price: '100.00',
  ...overrides,
})

const receivedLine = (overrides: Partial<ReceivedLineInput> = {}): ReceivedLineInput => ({
  order_item_id: 'poi-1',
  product_id: 'prod-1',
  variant_id: null,
  description: 'Tornillo 8mm',
  quantity: '10',
  ...overrides,
})

const invoicedLine = (overrides: Partial<InvoicedLineInput> = {}): InvoicedLineInput => ({
  product_id: 'prod-1',
  variant_id: null,
  description: 'Tornillo 8mm',
  quantity: '10',
  unit_price: '100.00',
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('reconcileOrderLines', () => {
  it('flags nothing when ordered, received, and invoiced all match', () => {
    const { items, summary } = reconcileOrderLines([orderedLine()], [receivedLine()], [invoicedLine()])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      ordered_qty: '10.00',
      received_qty: '10.00',
      invoiced_qty: '10.00',
      ordered_unit_price: '100.00',
      invoiced_unit_price: '100.00',
      qty_mismatch: false,
      price_mismatch: false,
      is_extra: false,
    })
    expect(summary).toMatchObject({
      qty_mismatch: false,
      price_mismatch: false,
      has_differences: false,
      ordered_total: '1000.00',
      invoiced_total: '1000.00',
    })
  })

  it('tolerates differences within 0.01', () => {
    const { summary } = reconcileOrderLines(
      [orderedLine({ quantity: '10', unit_price: '100.00' })],
      [receivedLine({ quantity: '10.005' })],
      [invoicedLine({ quantity: '10', unit_price: '100.01' })],
    )
    expect(summary.has_differences).toBe(false)
  })

  it('flags qty_mismatch when received differs from ordered', () => {
    const { items, summary } = reconcileOrderLines(
      [orderedLine({ quantity: '10' })],
      [receivedLine({ quantity: '8' })],
      [invoicedLine({ quantity: '8' })],
    )

    expect(items[0].qty_mismatch).toBe(true)
    expect(items[0].price_mismatch).toBe(false)
    expect(summary.qty_mismatch).toBe(true)
    expect(summary.price_mismatch).toBe(false)
    expect(summary.has_differences).toBe(true)
  })

  it('flags qty_mismatch when invoiced differs from received', () => {
    const { items } = reconcileOrderLines(
      [orderedLine({ quantity: '10' })],
      [receivedLine({ quantity: '10' })],
      [invoicedLine({ quantity: '12' })],
    )
    expect(items[0].qty_mismatch).toBe(true)
  })

  it('flags price_mismatch when an invoice unit price differs beyond 0.01', () => {
    const { items, summary } = reconcileOrderLines(
      [orderedLine({ unit_price: '100.00' })],
      [receivedLine()],
      [invoicedLine({ unit_price: '105.50' })],
    )

    expect(items[0].price_mismatch).toBe(true)
    expect(items[0].qty_mismatch).toBe(false)
    expect(items[0].invoiced_unit_price).toBe('105.50')
    expect(summary.price_mismatch).toBe(true)
    expect(summary.has_differences).toBe(true)
  })

  it('flags a partial receipt (received < ordered, nothing invoiced yet)', () => {
    const { items, summary } = reconcileOrderLines(
      [orderedLine({ quantity: '10' })],
      [receivedLine({ quantity: '4' })],
      [],
    )

    expect(items[0]).toMatchObject({
      ordered_qty: '10.00',
      received_qty: '4.00',
      invoiced_qty: '0.00',
      invoiced_unit_price: null,
      qty_mismatch: true,
      price_mismatch: false,
    })
    expect(summary.has_differences).toBe(true)
  })

  it('accumulates multiple receipts and invoices for the same PO line', () => {
    const { items } = reconcileOrderLines(
      [orderedLine({ quantity: '10', unit_price: '100.00' })],
      [receivedLine({ quantity: '6' }), receivedLine({ quantity: '4' })],
      [invoicedLine({ quantity: '5', unit_price: '100.00' }), invoicedLine({ quantity: '5', unit_price: '100.00' })],
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      received_qty: '10.00',
      invoiced_qty: '10.00',
      qty_mismatch: false,
      price_mismatch: false,
    })
  })

  it('matches invoice lines without product_id by normalized description', () => {
    const { items } = reconcileOrderLines(
      [orderedLine({ product_id: null, variant_id: null, description: 'Flete a depósito' })],
      [],
      [invoicedLine({ product_id: null, variant_id: null, description: '  flete a depósito ', quantity: '10', unit_price: '100.00' })],
    )

    expect(items).toHaveLength(1)
    expect(items[0].invoiced_qty).toBe('10.00')
  })

  it('marks invoiced lines without a matching PO line as extra', () => {
    const { items, summary } = reconcileOrderLines(
      [orderedLine()],
      [receivedLine()],
      [invoicedLine(), invoicedLine({ product_id: 'prod-99', description: 'Item no pedido', quantity: '2', unit_price: '50.00' })],
    )

    const extra = items.find(i => i.is_extra)
    expect(extra).toBeDefined()
    expect(extra).toMatchObject({
      ordered_qty: '0.00',
      ordered_unit_price: null,
      invoiced_qty: '2.00',
      qty_mismatch: true,
      price_mismatch: false,
    })
    expect(summary.has_differences).toBe(true)
  })
})

describe('listReconciliation', () => {
  it('computes rollups per order and filters by only_differences', async () => {
    ;(PurchaseOrder.findAll as Mock).mockResolvedValue([
      {
        id: 'po-1',
        order_number: 'OC-0001',
        status: 'received',
        expected_date: null,
        total: '1000.00',
        created_at: new Date('2026-06-01T00:00:00Z'),
        contact: { id: 'c-1', legal_name: 'Proveedor SA', trade_name: null },
      },
      {
        id: 'po-2',
        order_number: 'OC-0002',
        status: 'sent',
        expected_date: null,
        total: '500.00',
        created_at: new Date('2026-06-02T00:00:00Z'),
        contact: null,
      },
    ])
    ;(PurchaseOrderItem.findAll as Mock).mockResolvedValue([
      { id: 'poi-1', order_id: 'po-1', product_id: 'prod-1', variant_id: null, description: 'A', quantity: '10', unit_price: '100.00' },
      { id: 'poi-2', order_id: 'po-2', product_id: 'prod-2', variant_id: null, description: 'B', quantity: '5', unit_price: '100.00' },
    ])
    ;(PurchaseReceipt.findAll as Mock).mockResolvedValue([
      {
        id: 'rec-1',
        order_id: 'po-1',
        receipt_number: 'REC-0001',
        status: 'confirmed',
        receipt_date: null,
        items: [{ id: 'ri-1', order_item_id: 'poi-1', product_id: 'prod-1', variant_id: null, description: 'A', quantity: '10' }],
      },
    ])
    ;(SupplierInvoice.findAll as Mock).mockResolvedValue([
      {
        id: 'fc-1',
        order_id: 'po-1',
        receipt_id: null,
        invoice_number: 'FC-0001',
        supplier_invoice_number: null,
        status: 'received',
        total: '1210.00',
        items: [{ id: 'fi-1', product_id: 'prod-1', variant_id: null, description: 'A', quantity: '10', unit_price: '100.00' }],
      },
    ])

    const result = await listReconciliation(
      { page: 1, limit: 20, only_differences: true },
      tenantCtx,
    )

    // po-1 matches fully; po-2 has nothing received → only po-2 has differences.
    expect(result.total).toBe(1)
    expect(result.data[0]).toMatchObject({
      id: 'po-2',
      order_number: 'OC-0002',
      qty_mismatch: true,
      has_differences: true,
    })
  })
})
