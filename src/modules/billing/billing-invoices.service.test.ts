import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./billing-invoice.model', () => ({ default: { findByPk: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn() } }))
vi.mock('./billing-invoice-item.model', () => ({ default: { bulkCreate: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-payment.model', () => ({ default: { findAll: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./org-subscription.model', () => ({ default: { findByPk: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./subscription-addon.model', () => ({ default: { belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-plan.model', () => ({ default: { belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-metric.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./billing.numbering', () => ({ nextBillingNumber: vi.fn().mockResolvedValue('BILL-000001') }))
vi.mock('./usage.service', () => ({ aggregateUsage: vi.fn().mockResolvedValue([]), markUsageInvoiced: vi.fn() }))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb) => cb({ lock: true })) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))

import BillingInvoice from './billing-invoice.model'
import BillingPayment from './billing-payment.model'
import { issueBillingInvoice, voidBillingInvoice, recalcBillingInvoiceBalance } from './billing-invoices.service'

const mockInvoice = (overrides = {}) => ({
  id: 'inv-1',
  status: 'draft',
  total: '12100.00',
  paid_amount: '0.00',
  balance: '12100.00',
  due_date: null,
  update: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue({ id: 'inv-1' }),
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('issueBillingInvoice', () => {
  it('transitions draft → issued and stamps issue/due dates', async () => {
    const inv = mockInvoice()
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(inv)

    await issueBillingInvoice('inv-1', 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('throws when not in draft', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'issued' }))
    await expect(issueBillingInvoice('inv-1', 'a')).rejects.toThrow('BILLING_INVOICE_ALREADY_ISSUED')
  })

  it('throws when missing', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(null)
    await expect(issueBillingInvoice('x', 'a')).rejects.toThrow('BILLING_INVOICE_NOT_FOUND')
  })
})

describe('voidBillingInvoice', () => {
  it('voids an unpaid issued invoice', async () => {
    const inv = mockInvoice({ status: 'issued' })
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(inv)

    await voidBillingInvoice('inv-1', 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'void', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('refuses to void a paid invoice', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'paid' }))
    await expect(voidBillingInvoice('inv-1', 'a')).rejects.toThrow('BILLING_INVOICE_PAID_NOT_VOIDABLE')
  })

  it('refuses to void an invoice with payments', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'partially_paid', paid_amount: '500.00' }))
    await expect(voidBillingInvoice('inv-1', 'a')).rejects.toThrow('BILLING_INVOICE_HAS_PAYMENTS')
  })
})

describe('recalcBillingInvoiceBalance', () => {
  it('marks invoice paid when payments cover the total', async () => {
    const inv = mockInvoice({ status: 'issued' })
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(inv)
    ;(BillingPayment.findAll as Mock).mockResolvedValue([{ amount: '12100.00' }])

    await recalcBillingInvoiceBalance('inv-1', { lock: true } as never)

    expect(inv.update).toHaveBeenCalledWith(
      { paid_amount: '12100.00', balance: '0.00', status: 'paid' },
      expect.anything(),
    )
  })

  it('marks invoice partially_paid for a partial payment', async () => {
    const inv = mockInvoice({ status: 'issued' })
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(inv)
    ;(BillingPayment.findAll as Mock).mockResolvedValue([{ amount: '5000.00' }])

    await recalcBillingInvoiceBalance('inv-1', { lock: true } as never)

    expect(inv.update).toHaveBeenCalledWith(
      { paid_amount: '5000.00', balance: '7100.00', status: 'partially_paid' },
      expect.anything(),
    )
  })

  it('never reactivates a void invoice', async () => {
    const inv = mockInvoice({ status: 'void' })
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(inv)
    ;(BillingPayment.findAll as Mock).mockResolvedValue([])

    await recalcBillingInvoiceBalance('inv-1', { lock: true } as never)

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'void' }),
      expect.anything(),
    )
  })
})
