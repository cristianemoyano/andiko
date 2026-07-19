import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  orderFindOne: vi.fn(),
  orderItemFindAll: vi.fn(),
  invoiceFindOne: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceItemBulkCreate: vi.fn(),
  stockFindOne: vi.fn(),
  deductStockForOrder: vi.fn(),
  postInvoiceIssuedAccounting: vi.fn(),
  postSalesPaymentAccounting: vi.fn(),
  nextDocumentNumber: vi.fn(),
  paymentCount: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: { transaction: mocks.transaction },
}))
vi.mock('@/modules/sales/sales-order.model', () => ({
  default: { findOne: mocks.orderFindOne },
}))
vi.mock('@/modules/sales/sales-order-item.model', () => ({
  default: { findAll: mocks.orderItemFindAll },
}))
vi.mock('@/modules/sales/invoice.model', () => ({
  default: {
    findOne: mocks.invoiceFindOne,
    create: mocks.invoiceCreate,
  },
}))
vi.mock('@/modules/sales/invoice-item.model', () => ({
  default: { bulkCreate: mocks.invoiceItemBulkCreate },
}))
vi.mock('@/modules/inventory/stock-movement.model', () => ({
  default: { findOne: mocks.stockFindOne },
}))
vi.mock('@/modules/inventory/stock-movements.service', () => ({
  deductStockForOrder: mocks.deductStockForOrder,
}))
vi.mock('@/modules/sales/sales.utils', () => ({
  nextDocumentNumber: mocks.nextDocumentNumber,
}))
vi.mock('@/modules/sales/invoices.service', () => ({
  recalcInvoiceBalance: vi.fn(),
}))
vi.mock('@/modules/sales/payment.model', () => ({
  default: { count: mocks.paymentCount },
}))
vi.mock('@/modules/accounting/sales-invoice-accounting.service', () => ({
  postInvoiceIssuedAccounting: mocks.postInvoiceIssuedAccounting,
}))
vi.mock('@/modules/accounting/sales-payment-accounting.service', () => ({
  postSalesPaymentAccounting: mocks.postSalesPaymentAccounting,
}))
vi.mock('@/modules/sales/invoice-item-cost', () => ({
  resolveVariantUnitCosts: vi.fn().mockResolvedValue(new Map()),
  snapshotUnitCost: vi.fn().mockReturnValue(null),
}))

import { finalizePosSaleInErp } from './pos-sales-finalize.service'

const t = { LOCK: { UPDATE: 'UPDATE' } }

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    org_id: 'org-1',
    branch_id: 'branch-1',
    contact_id: 'contact-1',
    price_list_id: null,
    source: 'pos',
    status: 'confirmed',
    cae: '12345678901234',
    issue_date: new Date('2026-07-01'),
    created_at: new Date('2026-07-01'),
    payment_condition: 'cash',
    currency: 'ARS',
    subtotal: '100.00',
    discount_amount: '0.00',
    tax_amount: '21.00',
    total: '121.00',
    notes: null,
    salesperson_id: null,
    created_by: null,
    updated_by: null,
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (trx: typeof t) => Promise<unknown>) => fn(t))
  mocks.orderFindOne.mockResolvedValue(mockOrder())
  mocks.orderItemFindAll.mockResolvedValue([{
    product_id: 'p1',
    variant_id: 'v1',
    description: 'Item',
    quantity: '1.0000',
    unit_price: '100.00',
    discount_pct: '0.00',
    iva_rate: '21',
    subtotal: '100.00',
    discount_amount: '0.00',
    tax_base: '100.00',
    tax_amount: '21.00',
    total: '121.00',
    sort_order: 0,
  }])
  mocks.invoiceFindOne.mockResolvedValue(null)
  mocks.stockFindOne.mockResolvedValue(null)
  mocks.deductStockForOrder.mockResolvedValue(undefined)
  mocks.nextDocumentNumber.mockResolvedValue('FAC-0001')
  mocks.invoiceCreate.mockResolvedValue({
    id: 'inv-1',
    reload: vi.fn().mockResolvedValue({ id: 'inv-1' }),
  })
  mocks.invoiceItemBulkCreate.mockResolvedValue([])
  mocks.paymentCount.mockResolvedValue(0)
  mocks.postInvoiceIssuedAccounting.mockResolvedValue(undefined)
  mocks.postSalesPaymentAccounting.mockResolvedValue(undefined)
})

describe('finalizePosSaleInErp', () => {
  it('succeeds without cashier and passes empty userId to accounting (not orgId)', async () => {
    await finalizePosSaleInErp('order-1', 'org-1', { requireAfip: true, payments: [] })

    expect(mocks.postInvoiceIssuedAccounting).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ orgId: 'org-1', userId: '' }),
      t,
      expect.objectContaining({ invoice: expect.objectContaining({ id: 'inv-1' }) }),
    )
    expect(mocks.deductStockForOrder).toHaveBeenCalledWith('order-1', 'org-1', null, t)
  })
})
