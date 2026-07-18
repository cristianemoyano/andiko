import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))

const { expenseItemBulkCreate, scheduleItemBulkCreate } = vi.hoisted(() => ({
  expenseItemBulkCreate: vi.fn(),
  scheduleItemBulkCreate: vi.fn(),
}))

vi.mock('./expense-item.model', () => ({
  default: { bulkCreate: expenseItemBulkCreate },
}))
vi.mock('./expense-schedule-item.model', () => ({
  default: { bulkCreate: scheduleItemBulkCreate },
}))

import { calculateExpenseItems, createExpenseItems } from './expense-items.service'

const items = [
  {
    description: 'Cargo fijo',
    quantity: 1,
    unit_price: 100,
    discount_pct: 0,
    iva_rate: '21' as const,
    expense_account_code: '5.2.05',
    sort_order: 0,
  },
  {
    description: 'Consumo',
    quantity: 2,
    unit_price: 50,
    discount_pct: 10,
    iva_rate: '10.5' as const,
    expense_account_code: '5.2.06',
    sort_order: 1,
  },
]

describe('expense item composition', () => {
  it('calculates document totals from independent line rates and discounts', () => {
    expect(calculateExpenseItems(items).totals).toEqual({
      subtotal: '200.00',
      discount_amount: '10.00',
      tax_amount: '30.45',
      total: '220.45',
    })
  })

  it('persists immutable calculated values on the occurrence lines', async () => {
    const t = {} as never

    await createExpenseItems('expense-1', items, 'org-1', 'user-1', t)

    expect(expenseItemBulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          expense_id: 'expense-1',
          org_id: 'org-1',
          description: 'Cargo fijo',
          subtotal: '100.00',
          tax_amount: '21.00',
          total: '121.00',
        }),
        expect.objectContaining({
          description: 'Consumo',
          subtotal: '100.00',
          discount_amount: '10.00',
          tax_amount: '9.45',
          total: '99.45',
        }),
      ],
      { transaction: t },
    )
  })
})
