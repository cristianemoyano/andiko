import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))

const { accountFindAll, entryCreate, entryFindOne, lineBulkCreate, invoiceFindByPk } = vi.hoisted(() => ({
  accountFindAll:  vi.fn(),
  entryCreate:     vi.fn(),
  entryFindOne:    vi.fn(),
  lineBulkCreate:  vi.fn(),
  invoiceFindByPk: vi.fn(),
}))

vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { create: entryCreate, findOne: entryFindOne } }))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate } }))
vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./accounting.utils')>()
  return { ...actual, nextEntryNumber: vi.fn(async () => 'AS-000001') }
})
vi.mock('@/modules/purchases/supplier-invoice.model', () => ({ default: { findByPk: invoiceFindByPk } }))

import { postSupplierInvoiceAccounting } from './purchase-invoice-accounting.service'
import logger from '@/lib/logger'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const ctx: TenantContext = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }
const t = {} as never

const ALL_ACCOUNTS = [
  { id: 'acc-inventory', code: '1.1.03.01', is_active: true, is_postable: true },
  { id: 'acc-iva-credit', code: '1.1.02.02', is_active: true, is_postable: true },
  { id: 'acc-payable',    code: '2.1.01.01', is_active: true, is_postable: true },
]

function mockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sinv-1',
    invoice_number: 'OC-0001',
    status: 'received',
    subtotal: '100.00',
    discount_amount: '0.00',
    tax_amount: '21.00',
    total: '121.00',
    branch_id: 'branch-1',
    invoice_date: new Date('2026-07-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  entryFindOne.mockResolvedValue(null)
  entryCreate.mockResolvedValue({ id: 'entry-1' })
  lineBulkCreate.mockResolvedValue([])
  accountFindAll.mockResolvedValue(ALL_ACCOUNTS)
})

describe('postSupplierInvoiceAccounting', () => {
  it('is idempotent — no-ops when an entry already exists', async () => {
    entryFindOne.mockResolvedValue({ id: 'existing' })
    invoiceFindByPk.mockResolvedValue(mockInvoice())

    await postSupplierInvoiceAccounting('sinv-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a draft invoice', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice({ status: 'draft' }))
    await postSupplierInvoiceAccounting('sinv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a cancelled invoice', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice({ status: 'cancelled' }))
    await postSupplierInvoiceAccounting('sinv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops when required accounts are missing and logs a warning', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())
    accountFindAll.mockResolvedValue([])
    await postSupplierInvoiceAccounting('sinv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'purchase_invoice' }),
      'accounting auto-post skipped',
    )
  })

  it('posts a balanced entry: debit inventory + IVA crédito, credit proveedores', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())

    await postSupplierInvoiceAccounting('sinv-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'purchase_invoice',
        source_id: 'sinv-1',
        status: 'posted',
        total_debit: '121.00',
        total_credit: '121.00',
      }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines).toHaveLength(3)
    expect(lines.find(l => l.account_id === 'acc-inventory')).toMatchObject({ debit: '100.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-iva-credit')).toMatchObject({ debit: '21.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-payable')).toMatchObject({ debit: '0.00', credit: '121.00' })
  })
})
