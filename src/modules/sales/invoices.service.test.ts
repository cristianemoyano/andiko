import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Op } from 'sequelize'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('./invoice.model', () => ({
  default: {
    findByPk: vi.fn(),
    findOne: vi.fn(),
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
vi.mock('./sales-branch-associations', () => ({
  ensureSalesBranchAssociations: vi.fn(),
  BRANCH_AFIP_ATTRIBUTES: ['id', 'name'],
}))
vi.mock('./sales.utils', () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue('FAC-0001'),
  calcLineItem:       vi.fn().mockReturnValue({ subtotal: '100.00', discount_amount: '0.00', tax_base: '100.00', tax_amount: '21.00', total: '121.00' }),
  calcDocumentTotals: vi.fn().mockReturnValue({ subtotal: '100.00', discount_amount: '0.00', tax_amount: '21.00', total: '121.00' }),
}))
vi.mock('./sales-line-items.validation', () => ({
  assertSaleLineItemsFromActiveCatalog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./sales-line-stock.service', () => ({
  assertSaleLineItemsHaveBranchStock: vi.fn().mockResolvedValue(undefined),
}))

import Invoice from './invoice.model'
import { issueInvoice, cancelInvoice, listInvoices, getInvoice } from './invoices.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: 'branch-1',
  allowedBranchIds: ['branch-1'],
  salesScopeOwn: false,
}

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
    ;(Invoice.findOne as Mock).mockResolvedValue(inv)

    await issueInvoice('inv-1', tenantCtx, 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('throws INVOICE_NOT_FOUND when invoice is missing', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    await expect(issueInvoice('bad-id', tenantCtx, 'actor')).rejects.toThrow('INVOICE_NOT_FOUND')
  })

  it('throws INVOICE_ALREADY_ISSUED when not in draft', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice({ status: 'issued' }))
    await expect(issueInvoice('inv-1', tenantCtx, 'actor')).rejects.toThrow('INVOICE_ALREADY_ISSUED')
  })
})

describe('cancelInvoice', () => {
  it('transitions any non-paid invoice → cancelled', async () => {
    const inv = mockInvoice({ status: 'issued' })
    ;(Invoice.findOne as Mock).mockResolvedValue(inv)

    await cancelInvoice('inv-1', tenantCtx, 'actor-1')

    expect(inv.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', updated_by: 'actor-1' }),
      expect.anything(),
    )
  })

  it('throws INVOICE_PAID_NOT_CANCELLABLE for paid invoices', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice({ status: 'paid' }))
    await expect(cancelInvoice('inv-1', tenantCtx, 'actor')).rejects.toThrow('INVOICE_PAID_NOT_CANCELLABLE')
  })

  it('throws INVOICE_ALREADY_CANCELLED for already-cancelled invoices', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice({ status: 'cancelled' }))
    await expect(cancelInvoice('inv-1', tenantCtx, 'actor')).rejects.toThrow('INVOICE_ALREADY_CANCELLED')
  })

  it('throws INVOICE_NOT_FOUND when invoice is missing', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    await expect(cancelInvoice('bad-id', tenantCtx, 'actor')).rejects.toThrow('INVOICE_NOT_FOUND')
  })
})

describe('listInvoices with sales:scope_own', () => {
  it('does not add salesperson filter when scope is off', async () => {
    ;(Invoice.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 })

    await listInvoices({ page: 1, limit: 20 }, tenantCtx)

    const call = (Invoice.findAndCountAll as Mock).mock.calls[0][0]
    expect(call.where).toEqual({ org_id: 'org-1', branch_id: { [Op.in]: ['branch-1'] } })
  })

  it('restricts list to own sales when scope is on', async () => {
    ;(Invoice.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 })
    const scopedCtx: TenantContext = { ...tenantCtx, salesScopeOwn: true }

    await listInvoices({ page: 1, limit: 20 }, scopedCtx)

    const call = (Invoice.findAndCountAll as Mock).mock.calls[0][0]
    expect(call.where).toEqual({
      [Op.and]: [
        { org_id: 'org-1', branch_id: { [Op.in]: ['branch-1'] } },
        {
          [Op.or]: [
            { salesperson_id: 'user-1' },
            { salesperson_id: null, created_by: 'user-1' },
          ],
        },
      ],
    })
  })
})

describe('getInvoice with sales:scope_own', () => {
  it('uses scoped where when fetching by id', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue({ id: 'inv-1' })
    const scopedCtx: TenantContext = { ...tenantCtx, salesScopeOwn: true }

    await getInvoice('inv-1', scopedCtx)

    const call = (Invoice.findOne as Mock).mock.calls[0][0]
    expect(call.where).toEqual({
      [Op.and]: [
        { org_id: 'org-1', branch_id: { [Op.in]: ['branch-1'] }, id: 'inv-1' },
        {
          [Op.or]: [
            { salesperson_id: 'user-1' },
            { salesperson_id: null, created_by: 'user-1' },
          ],
        },
      ],
    })
  })

  it('throws INVOICE_NOT_FOUND when scoped query returns nothing', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    const scopedCtx: TenantContext = { ...tenantCtx, salesScopeOwn: true }

    await expect(getInvoice('other-vendor-inv', scopedCtx)).rejects.toThrow('INVOICE_NOT_FOUND')
  })
})
