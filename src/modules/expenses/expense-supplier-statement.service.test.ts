import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('@/modules/contacts/contact.model', () => ({
  default: {
    findOne: vi.fn(),
  },
}))

vi.mock('./expense.model', () => ({
  default: {
    findAll: vi.fn(),
  },
}))

vi.mock('./expense-payment.model', () => ({
  default: {
    findAll: vi.fn(),
  },
}))

import Contact from '@/modules/contacts/contact.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import { getExpenseSupplierAccountStatement } from './expense-supplier-statement.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

function mockContact() {
  ;(Contact.findOne as Mock).mockResolvedValue({
    id: 'contact-1',
    legal_name: 'Consorcio SRL',
    trade_name: 'Consorcio',
  })
}

describe('getExpenseSupplierAccountStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockContact()
  })

  it('throws CONTACT_NOT_FOUND when the supplier does not exist in the org', async () => {
    ;(Contact.findOne as Mock).mockResolvedValue(null)

    await expect(
      getExpenseSupplierAccountStatement('missing', { page: 1, limit: 20, summary_only: false }, tenantCtx),
    ).rejects.toThrow('CONTACT_NOT_FOUND')
  })

  it('builds summary and running balance with partial payments', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-1',
        expense_number: 'GAS-0001',
        description: 'Seguridad',
        status: 'partially_paid',
        invoice_date: new Date('2026-01-01T12:00:00.000Z'),
        due_date: new Date('2026-01-06T12:00:00.000Z'),
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '40.00',
        balance: '60.00',
        currency: 'ARS',
      },
      {
        id: 'exp-2',
        expense_number: 'GAS-0002',
        description: 'Limpieza',
        status: 'partially_paid',
        invoice_date: new Date('2026-01-10T12:00:00.000Z'),
        due_date: new Date('2999-01-20T12:00:00.000Z'),
        created_at: new Date('2026-01-10T10:00:00.000Z'),
        total: '200.00',
        paid_amount: '140.00',
        balance: '60.00',
        currency: 'ARS',
      },
    ])
    ;(ExpensePayment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-1',
        expense_id: 'exp-1',
        payment_number: 'PAG-0001',
        payment_date: new Date('2026-01-05T12:00:00.000Z'),
        amount: '40.00',
        notes: null,
        expense: { status: 'partially_paid' },
      },
      {
        id: 'pay-2',
        expense_id: 'exp-2',
        payment_number: 'PAG-0002',
        payment_date: new Date('2026-01-12T12:00:00.000Z'),
        amount: '140.00',
        notes: null,
        expense: { status: 'partially_paid' },
      },
    ])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false },
      tenantCtx,
    )

    expect(result.summary).toMatchObject({
      total_invoiced: '300.00',
      total_paid: '180.00',
      balance: '120.00',
      overdue_balance: '60.00',
      current_balance: '60.00',
      debt_status: 'overdue',
    })
    expect(result.data).toHaveLength(4)
    expect(result.data[0]).toMatchObject({ movement_type: 'payment', running_balance: '120.00' })
    expect(result.data[3]).toMatchObject({ movement_type: 'invoice', running_balance: '100.00' })
  })

  it('excludes draft and cancelled expenses from statement lines', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-ok',
        expense_number: 'GAS-0100',
        description: 'Mantenimiento',
        status: 'received',
        invoice_date: new Date('2026-02-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-02-01T10:00:00.000Z'),
        total: '50.00',
        paid_amount: '0.00',
        balance: '50.00',
        currency: 'ARS',
      },
    ])
    ;(ExpensePayment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-valid',
        expense_id: 'exp-ok',
        payment_number: 'PAG-0100',
        payment_date: new Date('2026-02-03T12:00:00.000Z'),
        amount: '20.00',
        notes: null,
        expense: { status: 'received' },
      },
      {
        id: 'pay-cancelled',
        expense_id: 'exp-cancelled',
        payment_number: 'PAG-0101',
        payment_date: new Date('2026-02-04T12:00:00.000Z'),
        amount: '30.00',
        notes: null,
        expense: { status: 'cancelled' },
      },
      {
        id: 'pay-draft',
        expense_id: 'exp-draft',
        payment_number: 'PAG-0102',
        payment_date: new Date('2026-02-05T12:00:00.000Z'),
        amount: '10.00',
        notes: null,
        expense: { status: 'draft' },
      },
    ])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false },
      tenantCtx,
    )
    const ids = result.data.map(row => row.id)

    const expensesCall = (Expense.findAll as Mock).mock.calls[0]?.[0] as { where?: Record<string, unknown> } | undefined
    expect(expensesCall?.where).toEqual(expect.objectContaining({ contact_id: 'contact-1' }))
    expect(ids).toContain('invoice:exp-ok')
    expect(ids).toContain('payment:pay-valid')
    expect(ids).not.toContain('payment:pay-cancelled')
    expect(ids).not.toContain('payment:pay-draft')
  })

  it('keeps running balance with opening balance when filtering by date', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-1',
        expense_number: 'GAS-0001',
        description: 'Seguridad',
        status: 'partially_paid',
        invoice_date: new Date('2026-01-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '50.00',
        balance: '50.00',
        currency: 'ARS',
      },
      {
        id: 'exp-2',
        expense_number: 'GAS-0002',
        description: 'Limpieza',
        status: 'received',
        invoice_date: new Date('2026-01-10T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-01-10T10:00:00.000Z'),
        total: '200.00',
        paid_amount: '0.00',
        balance: '200.00',
        currency: 'ARS',
      },
    ])
    ;(ExpensePayment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-1',
        expense_id: 'exp-1',
        payment_number: 'PAG-0001',
        payment_date: new Date('2026-01-05T12:00:00.000Z'),
        amount: '50.00',
        notes: null,
        expense: { status: 'partially_paid' },
      },
    ])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false, from: new Date('2026-01-10T00:00:00.000Z') },
      tenantCtx,
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'invoice:exp-2',
      running_balance: '250.00',
    })
  })

  it('uses created_at as the movement date when invoice_date is missing', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-no-date',
        expense_number: 'GAS-0300',
        description: 'Expensas marzo',
        status: 'received',
        invoice_date: null,
        due_date: null,
        created_at: new Date('2026-03-15T10:00:00.000Z'),
        total: '80.00',
        paid_amount: '0.00',
        balance: '80.00',
        currency: 'ARS',
      },
    ])
    ;(ExpensePayment.findAll as Mock).mockResolvedValue([])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false },
      tenantCtx,
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'invoice:exp-no-date',
      date: '2026-03-15T10:00:00.000Z',
      debit: '80.00',
    })
  })

  it('returns summary only without querying payments when summary_only is set', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-1',
        expense_number: 'GAS-0001',
        description: 'Seguridad',
        status: 'paid',
        invoice_date: new Date('2026-01-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '100.00',
        balance: '0.00',
        currency: 'ARS',
      },
    ])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: true },
      tenantCtx,
    )

    expect(ExpensePayment.findAll as Mock).not.toHaveBeenCalled()
    expect(result.data).toHaveLength(0)
    expect(result.summary).toMatchObject({
      total_invoiced: '100.00',
      total_paid: '100.00',
      balance: '0.00',
      debt_status: 'up_to_date',
    })
  })

  it('shows newest movements first; same-day payment appears above the expense', async () => {
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        id: 'exp-day',
        expense_number: 'GAS-7777',
        description: 'Expensas abril',
        status: 'paid',
        invoice_date: new Date('2026-04-22T23:59:59.000Z'),
        due_date: null,
        created_at: new Date('2026-04-22T23:59:59.000Z'),
        total: '406318.00',
        paid_amount: '406318.00',
        balance: '0.00',
        currency: 'ARS',
      },
    ])
    ;(ExpensePayment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-day',
        expense_id: 'exp-day',
        payment_number: 'PAG-01-0002',
        payment_date: new Date('2026-04-22T00:00:01.000Z'),
        amount: '406318.00',
        notes: null,
        expense: { status: 'paid' },
      },
    ])

    const result = await getExpenseSupplierAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false },
      tenantCtx,
    )

    expect(result.data[0]).toMatchObject({
      movement_type: 'payment',
      running_balance: '0.00',
    })
    expect(result.data[1]).toMatchObject({
      movement_type: 'invoice',
      running_balance: '406318.00',
    })
  })
})
