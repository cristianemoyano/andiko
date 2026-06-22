import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./invoice.model', () => ({
  default: {
    findByPk: vi.fn(),
    findAndCountAll: vi.fn(),
    create: vi.fn(),
  },
}))
vi.mock('./invoice-item.model', () => ({
  default: { destroy: vi.fn(), bulkCreate: vi.fn() },
}))
vi.mock('./payment.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./sales-order.model', () => ({
  default: { belongsTo: vi.fn(), hasMany: vi.fn() },
}))
vi.mock('@/lib/db', () => ({
  default: {
    transaction: vi.fn((cb) => cb({ lock: true })),
  },
}))
vi.mock('@/modules/auth/user.model', () => ({
  default: class User {},
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/auth/branch.model', () => ({ default: { belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('@/modules/contacts/contact.model', () => ({ default: { belongsTo: vi.fn(), hasMany: vi.fn() } }))
vi.mock('./sales-branch-associations', () => ({ ensureSalesBranchAssociations: vi.fn() }))
vi.mock('./sales.utils', () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue('FAC-0001'),
  calcLineItem:       vi.fn().mockReturnValue({ subtotal: '100.00', discount_amount: '0.00', tax_base: '100.00', tax_amount: '21.00', total: '121.00' }),
  calcDocumentTotals: vi.fn().mockReturnValue({ subtotal: '100.00', discount_amount: '0.00', tax_amount: '21.00', total: '121.00' }),
}))

import Invoice from './invoice.model'
import { issueInvoice, cancelInvoice } from './invoices.service'

const mockInvoice = (overrides = {}) => ({
  id:        'inv-1',
  status:    'draft',
  total:     '121.00',
  balance:   '121.00',
  payment_condition: 'cash',
  due_date:  null,
  update:    vi.fn().mockResolvedValue(undefined),
  reload:    vi.fn().mockResolvedValue({ id: 'inv-1', status: 'issued' }),
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('issueInvoice', () => {
  it('transitions draft → issued and sets issue_date', async () => {
    const inv = mockInvoice()
    ;(Invoice.findByPk as Mock).mockResolvedValue(inv)

    await issueInvoice('inv-1', 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('throws INVOICE_NOT_FOUND when invoice is missing', async () => {
    ;(Invoice.findByPk as Mock).mockResolvedValue(null)
    await expect(issueInvoice('bad-id', 'actor')).rejects.toThrow('INVOICE_NOT_FOUND')
  })

  it('throws INVOICE_ALREADY_ISSUED when not in draft', async () => {
    ;(Invoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'issued' }))
    await expect(issueInvoice('inv-1', 'actor')).rejects.toThrow('INVOICE_ALREADY_ISSUED')
  })
})

describe('cancelInvoice', () => {
  it('transitions any non-paid invoice → cancelled', async () => {
    const inv = mockInvoice({ status: 'issued' })
    ;(Invoice.findByPk as Mock).mockResolvedValue(inv)

    await cancelInvoice('inv-1', 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('throws INVOICE_PAID_NOT_CANCELLABLE for paid invoices', async () => {
    ;(Invoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'paid' }))
    await expect(cancelInvoice('inv-1', 'actor')).rejects.toThrow('INVOICE_PAID_NOT_CANCELLABLE')
  })

  it('throws INVOICE_ALREADY_CANCELLED for already-cancelled invoices', async () => {
    ;(Invoice.findByPk as Mock).mockResolvedValue(mockInvoice({ status: 'cancelled' }))
    await expect(cancelInvoice('inv-1', 'actor')).rejects.toThrow('INVOICE_ALREADY_CANCELLED')
  })

  it('throws INVOICE_NOT_FOUND when invoice is missing', async () => {
    ;(Invoice.findByPk as Mock).mockResolvedValue(null)
    await expect(cancelInvoice('bad-id', 'actor')).rejects.toThrow('INVOICE_NOT_FOUND')
  })
})
