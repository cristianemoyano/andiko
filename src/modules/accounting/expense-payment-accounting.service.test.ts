import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { accountFindAll, entryCreate, entryFindOne, lineBulkCreate, paymentFindByPk, CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE } = vi.hoisted(() => ({
  accountFindAll:  vi.fn(),
  entryCreate:     vi.fn(),
  entryFindOne:    vi.fn(),
  lineBulkCreate:  vi.fn(),
  paymentFindByPk: vi.fn(),
  CASH_ACCOUNT_CODE: '1.1.01.01',
  BANK_ACCOUNT_CODE: '1.1.01.02',
}))

vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { create: entryCreate, findOne: entryFindOne } }))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate } }))
vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting-period-guards', () => ({
  clampDateOutOfClosedPeriods: vi.fn(async (_orgId: string, date: Date | string) => ({
    dateOnly: typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10),
    clamped: false,
  })),
}))
vi.mock('./accounting.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./accounting.utils')>()
  return {
    ...actual,
    nextEntryNumber: vi.fn(async () => 'AS-000001'),
    resolveCashOrBankAccountId: (byCode: Map<string, { id: string }>, paymentMethod: string) =>
      byCode.get(paymentMethod === 'cash' ? CASH_ACCOUNT_CODE : BANK_ACCOUNT_CODE)?.id,
  }
})
vi.mock('@/modules/expenses/expense-payment.model', () => ({ default: { findByPk: paymentFindByPk } }))

import { postExpensePaymentAccounting } from './expense-payment-accounting.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }
const t = {} as never

const ALL_ACCOUNTS = [
  { id: 'acc-payable', code: '2.1.01.01', is_active: true, is_postable: true },
  { id: 'acc-cash',    code: '1.1.01.01', is_active: true, is_postable: true },
  { id: 'acc-bank',    code: '1.1.01.02', is_active: true, is_postable: true },
]

function mockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'epay-1',
    payment_number: 'PEXP-01-0001',
    amount: '100.00',
    payment_method: 'transfer',
    branch_id: 'branch-1',
    payment_date: new Date('2026-07-01'),
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

describe('postExpensePaymentAccounting', () => {
  it('is idempotent — no-ops when an entry already exists', async () => {
    entryFindOne.mockResolvedValue({ id: 'existing' })
    paymentFindByPk.mockResolvedValue(mockPayment())

    await postExpensePaymentAccounting('epay-1', ctx, t)

    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops when the payment amount is zero', async () => {
    paymentFindByPk.mockResolvedValue(mockPayment({ amount: '0.00' }))
    await postExpensePaymentAccounting('epay-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('no-ops when required accounts are missing', async () => {
    paymentFindByPk.mockResolvedValue(mockPayment())
    accountFindAll.mockResolvedValue([])
    await postExpensePaymentAccounting('epay-1', ctx, t)
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('debits proveedores and credits Banco for non-cash payments', async () => {
    paymentFindByPk.mockResolvedValue(mockPayment({ payment_method: 'transfer' }))

    await postExpensePaymentAccounting('epay-1', ctx, t)

    expect(entryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'expense_payment', source_id: 'epay-1', status: 'posted', total_debit: '100.00', total_credit: '100.00' }),
      expect.anything(),
    )
    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines.find(l => l.account_id === 'acc-payable')).toMatchObject({ debit: '100.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'acc-bank')).toMatchObject({ debit: '0.00', credit: '100.00' })
  })

  it('credits Caja for cash payments', async () => {
    paymentFindByPk.mockResolvedValue(mockPayment({ payment_method: 'cash' }))

    await postExpensePaymentAccounting('epay-1', ctx, t)

    const lines = lineBulkCreate.mock.calls[0]![0] as Array<{ account_id: string; debit: string; credit: string }>
    expect(lines.find(l => l.account_id === 'acc-cash')).toMatchObject({ debit: '0.00', credit: '100.00' })
  })
})
