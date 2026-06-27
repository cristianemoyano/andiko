import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./billing-payment.model', () => ({ default: { findByPk: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-invoice.model', () => ({ default: { findByPk: vi.fn(), belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./billing-invoices.service', () => ({ recalcBillingInvoiceBalance: vi.fn() }))
vi.mock('./billing.numbering', () => ({ nextBillingNumber: vi.fn().mockResolvedValue('BPAY-000001') }))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb) => cb({ lock: true })) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))

import BillingInvoice from './billing-invoice.model'
import BillingPayment from './billing-payment.model'
import { recalcBillingInvoiceBalance } from './billing-invoices.service'
import { createBillingPayment, deleteBillingPayment } from './billing-payments.service'

const mockInvoice = (overrides = {}) => ({
  id: 'inv-1',
  org_id: 'org-1',
  status: 'issued',
  total: '12100.00',
  balance: '12100.00',
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('createBillingPayment', () => {
  it('creates a payment and recalculates the invoice balance', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice())
    ;(BillingPayment.create as Mock).mockResolvedValue({ id: 'pay-1' })

    const input = { invoice_id: 'inv-1', amount: '5000.00', payment_method: 'transfer' as const }
    await createBillingPayment(input, 'actor-1')

    expect(BillingPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoice_id: 'inv-1', amount: '5000.00', org_id: 'org-1', payment_number: 'BPAY-000001' }),
      expect.anything(),
    )
    expect(recalcBillingInvoiceBalance).toHaveBeenCalledWith('inv-1', expect.anything())
  })

  it('rejects payment on a draft invoice', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'draft' }))
    await expect(createBillingPayment({ invoice_id: 'inv-1', amount: '100.00', payment_method: 'cash' }, 'a'))
      .rejects.toThrow('BILLING_INVOICE_NOT_ISSUED')
  })

  it('rejects payment on a void invoice', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'void' }))
    await expect(createBillingPayment({ invoice_id: 'inv-1', amount: '100.00', payment_method: 'cash' }, 'a'))
      .rejects.toThrow('BILLING_INVOICE_VOID')
  })

  it('rejects an amount exceeding the balance', async () => {
    ;(BillingInvoice.findByPk as Mock).mockResolvedValue(mockInvoice({ balance: '100.00' }))
    await expect(createBillingPayment({ invoice_id: 'inv-1', amount: '500.00', payment_method: 'cash' }, 'a'))
      .rejects.toThrow('BILLING_PAYMENT_EXCEEDS_BALANCE')
  })
})

describe('deleteBillingPayment', () => {
  it('soft-deletes and recalculates the invoice balance', async () => {
    const payment = { id: 'pay-1', invoice_id: 'inv-1', update: vi.fn().mockResolvedValue(undefined), destroy: vi.fn().mockResolvedValue(undefined) }
    ;(BillingPayment.findByPk as Mock).mockResolvedValue(payment)

    await deleteBillingPayment('pay-1', 'actor-1')

    expect(payment.destroy).toHaveBeenCalled()
    expect(recalcBillingInvoiceBalance).toHaveBeenCalledWith('inv-1', expect.anything())
  })

  it('throws when the payment is missing', async () => {
    ;(BillingPayment.findByPk as Mock).mockResolvedValue(null)
    await expect(deleteBillingPayment('x', 'a')).rejects.toThrow('BILLING_PAYMENT_NOT_FOUND')
  })
})
