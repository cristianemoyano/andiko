import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: { transaction: (cb: (t: unknown) => unknown) => cb({}) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { expenseFindByPk, expenseFindOne, paymentFindAll, calcExpenseTotalsMock } = vi.hoisted(() => ({
  expenseFindByPk: vi.fn(),
  expenseFindOne: vi.fn(),
  paymentFindAll: vi.fn(),
  calcExpenseTotalsMock: vi.fn(),
}))

vi.mock('./expense.model', () => ({ default: { findByPk: expenseFindByPk, findOne: expenseFindOne } }))
vi.mock('./expense-payment.model', () => ({ default: { findAll: paymentFindAll } }))
vi.mock('./expense-installment.model', () => ({
  default: { findOne: vi.fn(), findAll: vi.fn(), update: vi.fn(), bulkCreate: vi.fn() },
}))
vi.mock('./expense-schedule.model', () => ({ default: {} }))
vi.mock('./expense-schedules.service', () => ({ createExpenseSchedule: vi.fn() }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', () => ({
  nextExpenseDocNumber: vi.fn(),
  calcExpenseTotals: calcExpenseTotalsMock,
  calcExpenseTotalsFromGross: vi.fn(),
  buildInstallmentSchedule: vi.fn(),
  advanceNextRunDate: vi.fn(),
}))
vi.mock('@/modules/accounting/expense-accounting.service', () => ({ postExpenseAccounting: vi.fn() }))

import { recalcExpenseBalance, updateExpense } from './expenses.service'

const t = {} as never

function mockExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    kind: 'one_off',
    status: 'received',
    total: '121.00',
    subtotal: '100.00',
    discount_amount: '0.00',
    iva_rate: '0',
    paid_amount: '0.00',
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  calcExpenseTotalsMock.mockReturnValue({
    subtotal: '100.00',
    discount_amount: '0.00',
    tax_amount: '0.00',
    total: '100.00',
  })
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

describe('updateExpense', () => {
  it('recomputes totals using the persisted iva_rate when the request omits it', async () => {
    const expense = mockExpense({ iva_rate: '0', subtotal: '1000.00', discount_amount: '0.00', total: '1000.00' })
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { discount_amount: 50 }, 'org-1', 'actor-1')

    expect(calcExpenseTotalsMock).toHaveBeenCalledWith('1000.00', 50, '0')
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: '0' }),
      { transaction: {} },
    )
  })

  it('uses the newly provided iva_rate when the request includes one', async () => {
    const expense = mockExpense({ iva_rate: '0' })
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { iva_rate: '21' }, 'org-1', 'actor-1')

    expect(calcExpenseTotalsMock).toHaveBeenCalledWith('100.00', '0.00', '21')
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: '21' }),
      { transaction: {} },
    )
  })

  it('leaves totals and iva_rate untouched for updates that touch neither', async () => {
    const expense = mockExpense()
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { description: 'Nueva descripción' }, 'org-1', 'actor-1')

    expect(calcExpenseTotalsMock).not.toHaveBeenCalled()
    expect(expense.update).toHaveBeenCalledWith(
      { description: 'Nueva descripción', updated_by: 'actor-1' },
      { transaction: {} },
    )
  })
})
