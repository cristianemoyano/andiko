import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: { transaction: (cb: (t: unknown) => unknown) => cb({}) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { expenseFindByPk, expenseFindOne, paymentFindAll, paymentCount, calcExpenseTotalsMock, calcExpenseTotalsFromGrossMock } = vi.hoisted(() => ({
  expenseFindByPk: vi.fn(),
  expenseFindOne: vi.fn(),
  paymentFindAll: vi.fn(),
  paymentCount: vi.fn(),
  calcExpenseTotalsMock: vi.fn(),
  calcExpenseTotalsFromGrossMock: vi.fn(),
}))

vi.mock('./expense.model', () => ({ default: { findByPk: expenseFindByPk, findOne: expenseFindOne } }))
vi.mock('./expense-payment.model', () => ({ default: { findAll: paymentFindAll, count: paymentCount } }))
const { installmentFindOne, installmentFindAll } = vi.hoisted(() => ({
  installmentFindOne: vi.fn(),
  installmentFindAll: vi.fn(),
}))

vi.mock('./expense-installment.model', () => ({
  default: { findOne: installmentFindOne, findAll: installmentFindAll, update: vi.fn(), bulkCreate: vi.fn() },
}))
vi.mock('./expense-schedule.model', () => ({ default: {} }))
vi.mock('./expense-item.model', () => ({
  default: { destroy: vi.fn(), findAll: vi.fn() },
}))
vi.mock('./expense-schedule-item.model', () => ({ default: {} }))
vi.mock('./credit-card.model', () => ({ default: {} }))

const { statementFindOne } = vi.hoisted(() => ({ statementFindOne: vi.fn() }))
vi.mock('./credit-card-statement.model', () => ({ default: { findOne: statementFindOne } }))
vi.mock('./expense-items.service', () => ({
  calculateExpenseItems: vi.fn(),
  createExpenseItems: vi.fn(),
}))
vi.mock('./expense-schedules.service', () => ({ createExpenseSchedule: vi.fn() }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', () => ({
  nextExpenseDocNumber: vi.fn(),
  calcExpenseTotals: calcExpenseTotalsMock,
  calcExpenseTotalsFromGross: calcExpenseTotalsFromGrossMock,
  buildInstallmentSchedule: vi.fn(),
  advanceNextRunDate: vi.fn(),
}))
const { postExpenseAccountingMock, reverseExpenseAccountingMock } = vi.hoisted(() => ({
  postExpenseAccountingMock: vi.fn(),
  reverseExpenseAccountingMock: vi.fn(),
}))
vi.mock('@/modules/accounting/expense-accounting.service', () => ({
  postExpenseAccounting: postExpenseAccountingMock,
  reverseExpenseAccounting: reverseExpenseAccountingMock,
}))

import { recalcExpenseBalance, updateExpense, updateExpenseInstallment, revertExpenseToDraft } from './expenses.service'

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
    balance: '121.00',
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

  it('mirrors status and amounts onto a linked credit card statement', async () => {
    const expense = mockExpense({
      status: 'paid',
      paid_amount: '121.00',
      balance: '0.00',
      updated_by: 'actor-1',
    })
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([{ amount: '121.00' }])
    const statement = { update: vi.fn().mockResolvedValue(undefined) }
    statementFindOne.mockResolvedValue(statement)

    await recalcExpenseBalance('exp-1', t)

    expect(statement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expense.status,
        paid_amount: expense.paid_amount,
        balance: expense.balance,
      }),
      { transaction: t },
    )
  })
})

describe('updateExpense', () => {
  it('recomputes totals using the persisted iva_rate when the request omits it', async () => {
    const expense = mockExpense({ status: 'draft', iva_rate: '0', subtotal: '1000.00', discount_amount: '0.00', total: '1000.00' })
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { discount_amount: 50 }, 'org-1', 'actor-1')

    expect(calcExpenseTotalsMock).toHaveBeenCalledWith('1000.00', 50, '0')
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: '0' }),
      { transaction: {} },
    )
  })

  it('uses the newly provided iva_rate when the request includes one', async () => {
    const expense = mockExpense({ status: 'draft', iva_rate: '0' })
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { iva_rate: '21' }, 'org-1', 'actor-1')

    expect(calcExpenseTotalsMock).toHaveBeenCalledWith('100.00', '0.00', '21')
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: '21' }),
      { transaction: {} },
    )
  })

  it('rejects amount edits once the expense is confirmed', async () => {
    const expense = mockExpense({ status: 'received' })
    expenseFindOne.mockResolvedValue(expense)

    await expect(
      updateExpense('exp-1', { subtotal: 500 }, 'org-1', 'actor-1'),
    ).rejects.toThrow('EXPENSE_VALUES_LOCKED')
    expect(expense.update).not.toHaveBeenCalled()
  })

  it('still allows non-financial edits on a confirmed expense', async () => {
    const expense = mockExpense({ status: 'received' })
    expenseFindOne.mockResolvedValue(expense)

    await updateExpense('exp-1', { description: 'Nueva descripción' }, 'org-1', 'actor-1')

    expect(expense.update).toHaveBeenCalledWith(
      { description: 'Nueva descripción', updated_by: 'actor-1' },
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

describe('updateExpenseInstallment', () => {
  const newDate = new Date('2026-09-15T12:00:00.000Z')

  it('updates a pending cuota and refreshes the expense due_date to the next pending one', async () => {
    const expense = mockExpense({ kind: 'installment_plan', status: 'received' })
    expenseFindOne.mockResolvedValue(expense)
    const installment = { status: 'pending', update: vi.fn().mockResolvedValue(undefined) }
    installmentFindOne
      .mockResolvedValueOnce(installment)
      .mockResolvedValueOnce({ due_date: newDate })

    await updateExpenseInstallment('exp-1', 'inst-1', { due_date: newDate }, 'org-1', 'actor-1')

    expect(installment.update).toHaveBeenCalledWith(
      { due_date: newDate, updated_by: 'actor-1' },
      { transaction: {} },
    )
    expect(expense.update).toHaveBeenCalledWith(
      { due_date: newDate, updated_by: 'actor-1' },
      { transaction: {} },
    )
  })

  it('rejects cuotas that are already paid', async () => {
    const expense = mockExpense({ kind: 'installment_plan', status: 'received' })
    expenseFindOne.mockResolvedValue(expense)
    installmentFindOne.mockResolvedValueOnce({ status: 'paid', update: vi.fn() })

    await expect(
      updateExpenseInstallment('exp-1', 'inst-1', { due_date: newDate }, 'org-1', 'actor-1'),
    ).rejects.toThrow('INSTALLMENT_NOT_PENDING')
  })

  it('rejects expenses that are not installment plans', async () => {
    const expense = mockExpense({ kind: 'one_off', status: 'received' })
    expenseFindOne.mockResolvedValue(expense)

    await expect(
      updateExpenseInstallment('exp-1', 'inst-1', { due_date: newDate }, 'org-1', 'actor-1'),
    ).rejects.toThrow('EXPENSE_NOT_INSTALLMENT_PLAN')
  })

  it('recomputes totals and reposts accounting when editing a confirmed plan cuota', async () => {
    const expense = mockExpense({
      kind: 'installment_plan',
      status: 'received',
      branch_id: 'branch-1',
      discount_amount: '0.00',
      iva_rate: '21',
      total: '800.00',
    })
    expenseFindOne.mockResolvedValue(expense)
    expenseFindByPk.mockResolvedValue(expense)
    paymentFindAll.mockResolvedValue([])
    statementFindOne.mockResolvedValue(null)
    const installment = { status: 'pending', update: vi.fn().mockResolvedValue(undefined) }
    installmentFindOne
      .mockResolvedValueOnce(installment)
      .mockResolvedValue({ due_date: newDate })
    installmentFindAll
      .mockResolvedValueOnce([
        { amount: '500.00', status: 'pending' },
        { amount: '300.00', status: 'pending' },
      ])
      .mockResolvedValue([])
    calcExpenseTotalsFromGrossMock.mockReturnValue({
      subtotal: '661.16',
      discount_amount: '0.00',
      tax_amount: '138.84',
      total: '800.00',
    })

    await updateExpenseInstallment('exp-1', 'inst-1', { amount: 500 }, 'org-1', 'actor-1')

    expect(installment.update).toHaveBeenCalledWith(
      { amount: '500.00', updated_by: 'actor-1' },
      { transaction: {} },
    )
    expect(reverseExpenseAccountingMock).toHaveBeenCalledWith('exp-1', 'branch-1', expect.objectContaining({ orgId: 'org-1' }), {})
    expect(postExpenseAccountingMock).toHaveBeenCalledWith('exp-1', expect.objectContaining({ orgId: 'org-1' }), {})
  })

  it('updates the amount of a pending cuota in draft and recomputes plan totals', async () => {
    const expense = mockExpense({ kind: 'installment_plan', status: 'draft', discount_amount: '0.00', iva_rate: '21' })
    expenseFindOne.mockResolvedValue(expense)
    const installment = { status: 'pending', update: vi.fn().mockResolvedValue(undefined) }
    installmentFindOne
      .mockResolvedValueOnce(installment)
      .mockResolvedValueOnce({ due_date: newDate })
    installmentFindAll.mockResolvedValue([
      { amount: '500.00', status: 'pending' },
      { amount: '300.00', status: 'paid' },
    ])
    calcExpenseTotalsFromGrossMock.mockReturnValue({
      subtotal: '661.16',
      discount_amount: '0.00',
      tax_amount: '138.84',
      total: '800.00',
    })

    await updateExpenseInstallment('exp-1', 'inst-1', { amount: 500 }, 'org-1', 'actor-1')

    expect(installment.update).toHaveBeenCalledWith(
      { amount: '500.00', updated_by: 'actor-1' },
      { transaction: {} },
    )
    expect(calcExpenseTotalsFromGrossMock).toHaveBeenCalledWith('800.00', '0.00', '21')
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ total: '800.00', paid_amount: '300.00', balance: '500.00' }),
      { transaction: {} },
    )
  })
})

describe('revertExpenseToDraft', () => {
  it('reverses accounting and sends the expense back to draft', async () => {
    const expense = mockExpense({ status: 'received', branch_id: 'branch-1' })
    expenseFindOne.mockResolvedValue(expense)
    paymentCount.mockResolvedValue(0)
    statementFindOne.mockResolvedValue(null)

    await revertExpenseToDraft('exp-1', 'org-1', 'actor-1')

    expect(reverseExpenseAccountingMock).toHaveBeenCalledWith(
      'exp-1',
      'branch-1',
      expect.objectContaining({ orgId: 'org-1' }),
      {},
    )
    expect(expense.update).toHaveBeenCalledWith(
      { status: 'draft', updated_by: 'actor-1' },
      { transaction: {} },
    )
  })

  it('rejects when the expense has registered payments', async () => {
    const expense = mockExpense({ status: 'received' })
    expenseFindOne.mockResolvedValue(expense)
    paymentCount.mockResolvedValue(2)

    await expect(revertExpenseToDraft('exp-1', 'org-1', 'actor-1')).rejects.toThrow('EXPENSE_HAS_PAYMENTS')
    expect(reverseExpenseAccountingMock).not.toHaveBeenCalled()
  })

  it('rejects when the expense comes from a credit card statement', async () => {
    const expense = mockExpense({ status: 'received' })
    expenseFindOne.mockResolvedValue(expense)
    paymentCount.mockResolvedValue(0)
    statementFindOne.mockResolvedValue({ id: 'stmt-1' })

    await expect(revertExpenseToDraft('exp-1', 'org-1', 'actor-1')).rejects.toThrow('EXPENSE_FROM_CREDIT_CARD_STATEMENT')
    expect(reverseExpenseAccountingMock).not.toHaveBeenCalled()
  })

  it('rejects partially paid expenses', async () => {
    const expense = mockExpense({ status: 'partially_paid' })
    expenseFindOne.mockResolvedValue(expense)

    await expect(revertExpenseToDraft('exp-1', 'org-1', 'actor-1')).rejects.toThrow('EXPENSE_NOT_RECEIVED')
  })
})
