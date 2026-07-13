import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { expenseFindByPk, paymentFindAll } = vi.hoisted(() => ({
  expenseFindByPk: vi.fn(),
  paymentFindAll: vi.fn(),
}))

vi.mock('./expense.model', () => ({ default: { findByPk: expenseFindByPk } }))
vi.mock('./expense-payment.model', () => ({ default: { findAll: paymentFindAll } }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', () => ({
  nextExpenseDocNumber: vi.fn(),
  calcExpenseTotals: vi.fn(),
}))
vi.mock('@/modules/accounting/expense-accounting.service', () => ({ postExpenseAccounting: vi.fn() }))

import { recalcExpenseBalance } from './expenses.service'

const t = {} as never

function mockExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    status: 'received',
    total: '121.00',
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recalcExpenseBalance', () => {
  it('no-ops when the expense does not exist', async () => {
    expenseFindByPk.mockResolvedValue(null)
    await recalcExpenseBalance('exp-1', t)
    expect(paymentFindAll).not.toHaveBeenCalled()
  })

  it('no-ops for a cancelled expense', async () => {
    const expense = mockExpense({ status: 'cancelled' })
    expenseFindByPk.mockResolvedValue(expense)
    await recalcExpenseBalance('exp-1', t)
    expect(expense.update).not.toHaveBeenCalled()
  })

  it('marks as partially_paid when payments are below the total', async () => {
    const expense = mockExpense()
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([{ amount: '50.00' }])

    await recalcExpenseBalance('exp-1', t)

    expect(expense.update).toHaveBeenCalledWith(
      { paid_amount: '50.00', balance: '71.00', status: 'partially_paid' },
      { transaction: t },
    )
  })

  it('marks as paid when payments cover the total', async () => {
    const expense = mockExpense()
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([{ amount: '100.00' }, { amount: '21.00' }])

    await recalcExpenseBalance('exp-1', t)

    expect(expense.update).toHaveBeenCalledWith(
      { paid_amount: '121.00', balance: '0.00', status: 'paid' },
      { transaction: t },
    )
  })

  it('keeps the expense received (not paid/partial) when there are no payments', async () => {
    const expense = mockExpense()
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([])

    await recalcExpenseBalance('exp-1', t)

    expect(expense.update).toHaveBeenCalledWith(
      { paid_amount: '0.00', balance: '121.00', status: 'received' },
      { transaction: t },
    )
  })

  it('never leaves the balance negative even if payments exceed the total', async () => {
    const expense = mockExpense()
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([{ amount: '200.00' }])

    await recalcExpenseBalance('exp-1', t)

    expect(expense.update).toHaveBeenCalledWith(
      { paid_amount: '200.00', balance: '0.00', status: 'paid' },
      { transaction: t },
    )
  })
})
