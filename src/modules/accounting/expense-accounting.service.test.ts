import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { accountFindAll, entryCreate, entryFindOne, entryFindAll, lineBulkCreate, lineFindAll, expenseFindByPk, expenseItemFindAll } = vi.hoisted(() => ({
  accountFindAll:  vi.fn(),
  entryCreate:     vi.fn(),
  entryFindOne:    vi.fn(),
  entryFindAll:    vi.fn(),
  lineBulkCreate:  vi.fn(),
  lineFindAll:     vi.fn(),
  expenseFindByPk: vi.fn(),
  expenseItemFindAll: vi.fn(),
}))

vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { create: entryCreate, findOne: entryFindOne, findAll: entryFindAll } }))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate, findAll: lineFindAll } }))
vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting-period-guards', () => ({
  isDateInClosedPeriod: vi.fn(async () => false),
  clampDateOutOfClosedPeriods: vi.fn(async (_orgId: string, date: Date | string) => ({
    dateOnly: typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10),
    clamped: false,
  })),
}))
vi.mock('./accounting.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./accounting.utils')>()
  return { ...actual, nextEntryNumber: vi.fn(async () => 'AS-000001') }
})
vi.mock('@/modules/expenses/expense.model', () => ({ default: { findByPk: expenseFindByPk } }))
vi.mock('@/modules/expenses/expense-item.model', () => ({ default: { findAll: expenseItemFindAll } }))
vi.mock('@/modules/expenses/expense-installment.model', () => ({ default: { findAll: vi.fn(async () => []) } }))

import { postExpenseAccounting, reverseExpenseAccounting } from './expense-accounting.service'

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
    balance: '121.00',
    branch_id: 'branch-1',
    invoice_date: new Date('2026-07-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  entryFindOne.mockResolvedValue(null)
  entryFindAll.mockResolvedValue([])
  entryCreate.mockResolvedValue({ id: 'entry-1' })
  lineBulkCreate.mockResolvedValue([])
  lineFindAll.mockResolvedValue([])
  accountFindAll.mockResolvedValue(ALL_ACCOUNTS)
  expenseItemFindAll.mockResolvedValue([])
})

describe('postExpenseAccounting', () => {
  it('is idempotent — no-ops when a live entry already exists', async () => {
    entryFindAll
      .mockResolvedValueOnce([{ id: 'existing' }]) // expense_invoice entries
      .mockResolvedValueOnce([])                   // reversals
    expenseFindByPk.mockResolvedValue(mockExpense())

    await postExpenseAccounting('exp-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('posts a fresh entry when the previous one was reversed (corrección)', async () => {
    entryFindAll
      .mockResolvedValueOnce([{ id: 'old-entry' }])            // expense_invoice entries
      .mockResolvedValueOnce([{ source_id: 'old-entry' }])     // reversals
    expenseFindByPk.mockResolvedValue(mockExpense())

    await postExpenseAccounting('exp-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'expense_invoice', source_id: 'exp-1' }),
      expect.anything(),
    )
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

  it('debits each detail line to its own expense account', async () => {
    expenseFindByPk.mockResolvedValue(mockExpense({ tax_amount: '21.00', total: '171.00', balance: '171.00' }))
    expenseItemFindAll.mockResolvedValue([
      {
        description: 'Cargo fijo',
        expense_account_code: '5.2.05',
        subtotal: '100.00',
        discount_amount: '0.00',
      },
      {
        description: 'Servicio técnico',
        expense_account_code: '5.2.06',
        subtotal: '50.00',
        discount_amount: '0.00',
      },
    ])
    accountFindAll.mockResolvedValue([
      ...ALL_ACCOUNTS,
      { id: 'acc-servicios', code: '5.2.06', is_active: true, is_postable: true },
    ])

    await postExpenseAccounting('exp-1', ctx, t)

    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string }>
    expect(lines.find(line => line.account_id === 'acc-alquileres')).toMatchObject({ debit: '100.00' })
    expect(lines.find(line => line.account_id === 'acc-servicios')).toMatchObject({ debit: '50.00' })
  })
})

describe('reverseExpenseAccounting', () => {
  it('no-ops when the expense has no journal entries', async () => {
    await reverseExpenseAccounting('exp-1', 'branch-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('posts a mirror entry with debit and credit swapped', async () => {
    entryFindAll
      .mockResolvedValueOnce([{ id: 'entry-1', entry_number: 'AS-000001', entry_date: '2026-07-01' }])
      .mockResolvedValueOnce([]) // no reversals yet
    lineFindAll.mockResolvedValue([
      { account_id: 'acc-alquileres', debit: '100.00', credit: '0.00', description: 'Alquiler local' },
      { account_id: 'acc-iva-credit', debit: '21.00', credit: '0.00', description: 'IVA crédito fiscal' },
      { account_id: 'acc-payable', debit: '0.00', credit: '121.00', description: 'Gasto EXP-01-0001' },
    ])

    await reverseExpenseAccounting('exp-1', 'branch-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'expense_invoice_reversal',
        source_id: 'entry-1',
        total_debit: '121.00',
        total_credit: '121.00',
      }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines.find(l => l.account_id === 'acc-alquileres')).toMatchObject({ debit: '0.00', credit: '100.00' })
    expect(lines.find(l => l.account_id === 'acc-payable')).toMatchObject({ debit: '121.00', credit: '0.00' })
  })

  it('skips entries that were already reversed', async () => {
    entryFindAll
      .mockResolvedValueOnce([{ id: 'entry-1', entry_number: 'AS-000001', entry_date: '2026-07-01' }])
      .mockResolvedValueOnce([{ source_id: 'entry-1' }])

    await reverseExpenseAccounting('exp-1', 'branch-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })
})
