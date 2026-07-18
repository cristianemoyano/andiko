import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  default: { transaction: (cb: (t: unknown) => unknown) => cb({}) },
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('@/modules/accounting/expense-accounting.service', () => ({
  postExpenseAccounting: vi.fn(),
  reverseExpenseAccounting: vi.fn(),
}))

const { cardFindOne, expenseCreate, expenseFindOne, statementCreate, statementFindOne, paymentCount, nextDoc } = vi.hoisted(() => ({
  cardFindOne: vi.fn(),
  expenseCreate: vi.fn(),
  expenseFindOne: vi.fn(),
  statementCreate: vi.fn(),
  statementFindOne: vi.fn(),
  paymentCount: vi.fn(),
  nextDoc: vi.fn(),
}))

vi.mock('./credit-card.model', () => ({ default: { findOne: cardFindOne, findAndCountAll: vi.fn(), create: vi.fn() } }))
vi.mock('./credit-card-statement.model', () => ({ default: { create: statementCreate, findOne: statementFindOne, findAndCountAll: vi.fn() } }))
vi.mock('./expense.model', () => ({ default: { create: expenseCreate, findOne: expenseFindOne } }))
vi.mock('./expense-payment.model', () => ({ default: { count: paymentCount } }))
vi.mock('./expenses.utils', () => ({
  nextExpenseDocNumber: nextDoc,
  calcExpenseTotals: vi.fn(() => ({
    subtotal: '150000.00',
    discount_amount: '0.00',
    tax_amount: '0.00',
    total: '150000.00',
  })),
}))

import {
  computeStatementTotals,
  createCreditCardStatement,
  updateCreditCardStatementAmounts,
} from './credit-cards.service'
import { postExpenseAccounting, reverseExpenseAccounting } from '@/modules/accounting/expense-accounting.service'

beforeEach(() => {
  vi.clearAllMocks()
  nextDoc.mockResolvedValue('EXP-01-0009')
})

describe('computeStatementTotals', () => {
  it('sums ARS and converts USD with FX', () => {
    const totals = computeStatementTotals({
      amount_ars: 100_000,
      amount_usd: 50,
      fx_rate: 1000,
    })
    expect(totals.amount_ars).toBe('100000.00')
    expect(totals.amount_usd).toBe('50.00')
    expect(totals.fx_rate).toBe('1000.000000')
    expect(totals.amount_ars_total).toBe('150000.00')
    expect(totals.balance).toBe('150000.00')
  })

  it('ignores USD without FX', () => {
    const totals = computeStatementTotals({
      amount_ars: 10,
      amount_usd: 5,
      fx_rate: null,
    })
    expect(totals.amount_ars_total).toBe('10.00')
  })
})

describe('createCreditCardStatement', () => {
  it('creates linked expense + statement and posts accounting', async () => {
    cardFindOne.mockResolvedValue({
      id: 'card-1',
      branch_id: 'branch-1',
      contact_id: 'contact-1',
      name: 'Visa',
      last_four: '4242',
      expense_account_code: '5.1.01',
      is_active: true,
    })
    expenseCreate.mockResolvedValue({ id: 'exp-1' })
    statementCreate.mockResolvedValue({ id: 'stmt-1', expense_id: 'exp-1' })

    const result = await createCreditCardStatement(
      {
        credit_card_id: 'card-1',
        period_label: '2026-07',
        closing_date: new Date('2026-07-10T12:00:00.000Z'),
        due_date: new Date('2026-07-20T12:00:00.000Z'),
        amount_ars: 100_000,
        amount_usd: 50,
        fx_rate: 1000,
        notes: null,
      },
      'org-1',
      'user-1',
    )

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'received',
        kind: 'one_off',
        contact_id: 'contact-1',
        total: '150000.00',
      }),
      expect.anything(),
    )
    expect(statementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        period_label: '2026-07',
        amount_ars_total: '150000.00',
        expense_id: 'exp-1',
        status: 'received',
      }),
      expect.anything(),
    )
    expect(postExpenseAccounting).toHaveBeenCalledWith('exp-1', expect.anything(), expect.anything())
    expect(result.id).toBe('stmt-1')
  })

  it('rejects inactive cards', async () => {
    cardFindOne.mockResolvedValue({
      id: 'card-1',
      is_active: false,
      contact_id: 'c1',
    })
    await expect(
      createCreditCardStatement(
        {
          credit_card_id: 'card-1',
          period_label: '2026-07',
          closing_date: new Date(),
          due_date: new Date(),
          amount_ars: 10,
          amount_usd: 0,
          fx_rate: null,
          notes: null,
        },
        'org-1',
        'user-1',
      ),
    ).rejects.toThrow('CREDIT_CARD_INACTIVE')
  })
})

describe('updateCreditCardStatementAmounts', () => {
  function mockStatement(overrides: Record<string, unknown> = {}) {
    return {
      id: 'stmt-1',
      expense_id: 'exp-1',
      status: 'received',
      notes: null,
      update: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  function mockLinkedExpense(overrides: Record<string, unknown> = {}) {
    return {
      id: 'exp-1',
      status: 'received',
      branch_id: 'branch-1',
      update: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  it('updates statement + expense totals and redoes the journal entry', async () => {
    const statement = mockStatement()
    const expense = mockLinkedExpense()
    statementFindOne.mockResolvedValue(statement)
    expenseFindOne.mockResolvedValue(expense)
    paymentCount.mockResolvedValue(0)

    await updateCreditCardStatementAmounts(
      'stmt-1',
      { amount_ars: 100_000, amount_usd: 50, fx_rate: 1000 },
      'org-1',
      'user-1',
    )

    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ total: '150000.00', balance: '150000.00', notes: 'USD 50.00 @ 1000.000000' }),
      { transaction: {} },
    )
    expect(statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount_ars_total: '150000.00', balance: '150000.00' }),
      { transaction: {} },
    )
    expect(reverseExpenseAccounting).toHaveBeenCalledWith('exp-1', 'branch-1', expect.objectContaining({ orgId: 'org-1' }), {})
    expect(postExpenseAccounting).toHaveBeenCalledWith('exp-1', expect.objectContaining({ orgId: 'org-1' }), {})
  })

  it('rejects statements with registered payments', async () => {
    statementFindOne.mockResolvedValue(mockStatement())
    expenseFindOne.mockResolvedValue(mockLinkedExpense())
    paymentCount.mockResolvedValue(1)

    await expect(
      updateCreditCardStatementAmounts('stmt-1', { amount_ars: 10, amount_usd: 0, fx_rate: null }, 'org-1', 'user-1'),
    ).rejects.toThrow('STATEMENT_HAS_PAYMENTS')
    expect(reverseExpenseAccounting).not.toHaveBeenCalled()
  })

  it('rejects cancelled statements', async () => {
    statementFindOne.mockResolvedValue(mockStatement({ status: 'cancelled' }))

    await expect(
      updateCreditCardStatementAmounts('stmt-1', { amount_ars: 10, amount_usd: 0, fx_rate: null }, 'org-1', 'user-1'),
    ).rejects.toThrow('STATEMENT_CANCELLED')
  })
})
