import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { accountFindAll, entryCreate, entryFindOne, lineBulkCreate, invoiceFindByPk, itemFindAll, variantFindAll } = vi.hoisted(() => ({
  accountFindAll:  vi.fn(),
  entryCreate:     vi.fn(),
  entryFindOne:    vi.fn(),
  lineBulkCreate:  vi.fn(),
  invoiceFindByPk: vi.fn(),
  itemFindAll:     vi.fn(),
  variantFindAll:  vi.fn(),
}))

vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { create: entryCreate, findOne: entryFindOne } }))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate } }))
vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./accounting.utils')>()
  return { ...actual, nextEntryNumber: vi.fn(async () => 'AS-000001') }
})
vi.mock('@/modules/sales/invoice.model', () => ({ default: { findByPk: invoiceFindByPk } }))
vi.mock('@/modules/sales/invoice-item.model', () => ({ default: { findAll: itemFindAll } }))
vi.mock('@/modules/catalog/product-variant.model', () => ({ default: { findAll: variantFindAll } }))

import { postInvoiceIssuedAccounting } from './sales-invoice-accounting.service'
import logger from '@/lib/logger'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const ctx: TenantContext = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }
const t = {} as never

const ALL_ACCOUNTS = [
  { id: 'acc-sales',      code: '4.1.01',      is_active: true, is_postable: true },
  { id: 'acc-iva-debit',  code: '2.1.02.01',   is_active: true, is_postable: true },
  { id: 'acc-receivable', code: '1.1.02.01',   is_active: true, is_postable: true },
  { id: 'acc-cogs',       code: '5.1.01',      is_active: true, is_postable: true },
  { id: 'acc-inventory',  code: '1.1.03.01',   is_active: true, is_postable: true },
]

function mockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoice_number: 'FAC-0001',
    status: 'issued',
    subtotal: '100.00',
    discount_amount: '0.00',
    tax_amount: '21.00',
    total: '121.00',
    branch_id: 'branch-1',
    issue_date: new Date('2026-07-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  entryFindOne.mockResolvedValue(null)
  entryCreate.mockResolvedValue({ id: 'entry-1' })
  lineBulkCreate.mockResolvedValue([])
  itemFindAll.mockResolvedValue([])
  variantFindAll.mockResolvedValue([])
  accountFindAll.mockResolvedValue(ALL_ACCOUNTS)
})

describe('postInvoiceIssuedAccounting', () => {
  it('is idempotent — no-ops when an entry already exists', async () => {
    entryFindOne.mockResolvedValue({ id: 'existing' })
    invoiceFindByPk.mockResolvedValue(mockInvoice())

    await postInvoiceIssuedAccounting('inv-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a draft invoice', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice({ status: 'draft' }))
    await postInvoiceIssuedAccounting('inv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a cancelled invoice', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice({ status: 'cancelled' }))
    await postInvoiceIssuedAccounting('inv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops when required accounts are missing and logs a warning', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())
    accountFindAll.mockResolvedValue([])
    await postInvoiceIssuedAccounting('inv-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', sourceType: 'sales_invoice', sourceId: 'inv-1' }),
      'accounting auto-post skipped',
    )
  })

  it('posts a balanced entry when subtotal/discount/tax/total fields disagree by rounding', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice({
      subtotal: '1000.00',
      discount_amount: '100.00',
      tax_amount: '189.00',
      total: '1089.00',
    }))

    await postInvoiceIssuedAccounting('inv-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ total_debit: '1089.00', total_credit: '1089.00' }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines.find(l => l.account_id === 'acc-sales')).toMatchObject({ credit: '900.00' })
  })

  it('posts a balanced entry without COGS lines when no variant costs are found', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())

    await postInvoiceIssuedAccounting('inv-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'sales_invoice',
        source_id: 'inv-1',
        status: 'posted',
        total_debit: '121.00',
        total_credit: '121.00',
      }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines).toHaveLength(3)
    expect(lines.find(l => l.account_id === 'acc-receivable')).toMatchObject({ debit: '121.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-sales')).toMatchObject({ debit: '0.00', credit: '100.00' })
    expect(lines.find(l => l.account_id === 'acc-iva-debit')).toMatchObject({ debit: '0.00', credit: '21.00' })
  })

  it('adds a balanced COGS line pair when a variant has a cost_price', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())
    itemFindAll.mockResolvedValue([{ quantity: '2.0000', variant_id: 'variant-1' }])
    variantFindAll.mockResolvedValue([{ id: 'variant-1', cost_price: '30.00' }])

    await postInvoiceIssuedAccounting('inv-1', ctx, t)

    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines).toHaveLength(5)
    expect(lines.find(l => l.account_id === 'acc-cogs')).toMatchObject({ debit: '60.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-inventory')).toMatchObject({ debit: '0.00', credit: '60.00' })

    const totalDebit  = lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2)
  })

  it('skips COGS for lines without a variant_id or without a cost_price', async () => {
    invoiceFindByPk.mockResolvedValue(mockInvoice())
    itemFindAll.mockResolvedValue([
      { quantity: '1.0000', variant_id: null },
      { quantity: '1.0000', variant_id: 'variant-no-cost' },
    ])
    variantFindAll.mockResolvedValue([{ id: 'variant-no-cost', cost_price: null }])

    await postInvoiceIssuedAccounting('inv-1', ctx, t)

    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string }>
    expect(lines).toHaveLength(3)
    expect(lines.find(l => l.account_id === 'acc-cogs')).toBeUndefined()
  })
})
