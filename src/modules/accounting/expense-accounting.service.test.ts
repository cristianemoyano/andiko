import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { accountFindAll, entryCreate, entryFindOne, lineBulkCreate, expenseFindByPk } = vi.hoisted(() => ({
  accountFindAll:  vi.fn(),
  entryCreate:     vi.fn(),
  entryFindOne:    vi.fn(),
  lineBulkCreate:  vi.fn(),
  expenseFindByPk: vi.fn(),
}))

vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { create: entryCreate, findOne: entryFindOne } }))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate } }))
vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./accounting.utils')>()
  return { ...actual, nextEntryNumber: vi.fn(async () => 'AS-000001') }
})
vi.mock('@/modules/expenses/expense.model', () => ({ default: { findByPk: expenseFindByPk } }))

import { postExpenseAccounting } from './expense-accounting.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }
const t = {} as never

const ALL_ACCOUNTS = [
  { id: 'acc-alquileres', code: '5.2.05', is_active: true, is_postable: true },
  { id: 'acc-iva-credit', code: '1.1.02.02', is_active: true, is_postable: true },
  { id: 'acc-payable',    code: '2.1.01.01', is_active: true, is_postable: true },
]

function mockExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    expense_number: 'EXP-01-0001',
    description: 'Alquiler local',
    expense_account_code: '5.2.05',
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

describe('postExpenseAccounting', () => {
  it('is idempotent — no-ops when an entry already exists', async () => {
    entryFindOne.mockResolvedValue({ id: 'existing' })
    expenseFindByPk.mockResolvedValue(mockExpense())

    await postExpenseAccounting('exp-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a draft expense', async () => {
    expenseFindByPk.mockResolvedValue(mockExpense({ status: 'draft' }))
    await postExpenseAccounting('exp-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops for a cancelled expense', async () => {
    expenseFindByPk.mockResolvedValue(mockExpense({ status: 'cancelled' }))
    await postExpenseAccounting('exp-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops when the expense account is missing from the chart', async () => {
    expenseFindByPk.mockResolvedValue(mockExpense())
    accountFindAll.mockResolvedValue([])
    await postExpenseAccounting('exp-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
    expect((await import('@/lib/logger')).default.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'expense_invoice' }),
      'accounting auto-post skipped',
    )
  })

  it('posts a balanced entry: debit the expense account + IVA crédito, credit proveedores', async () => {
    expenseFindByPk.mockResolvedValue(mockExpense())

    await postExpenseAccounting('exp-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'expense_invoice',
        source_id: 'exp-1',
        status: 'posted',
        total_debit: '121.00',
        total_credit: '121.00',
      }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines).toHaveLength(3)
    expect(lines.find(l => l.account_id === 'acc-alquileres')).toMatchObject({ debit: '100.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-iva-credit')).toMatchObject({ debit: '21.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-payable')).toMatchObject({ debit: '0.00', credit: '121.00' })
  })
})
