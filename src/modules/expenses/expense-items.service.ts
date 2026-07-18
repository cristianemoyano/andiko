import 'server-only'
import type { Transaction } from 'sequelize'
import ExpenseItem from './expense-item.model'
import ExpenseScheduleItem from './expense-schedule-item.model'
import type { ExpenseLineItemInput } from './expense.schema'
import { calcExpenseDocumentTotals, calcExpenseLine } from './expenses.utils'
import type { IvaRate } from '@/types'

export function calculateExpenseItems(items: ExpenseLineItemInput[]) {
  const lines = items.map(item => ({
    item,
    totals: calcExpenseLine(item.quantity, item.unit_price, item.discount_pct, item.iva_rate as IvaRate),
  }))
  return {
    lines,
    totals: calcExpenseDocumentTotals(lines.map(line => line.totals)),
  }
}

export async function createExpenseItems(
  expenseId: string,
  items: ExpenseLineItemInput[],
  orgId: string,
  actorId: string | null,
  t: Transaction,
) {
  const calculated = calculateExpenseItems(items)
  await ExpenseItem.bulkCreate(
    calculated.lines.map(({ item, totals }, index) => ({
      org_id: orgId,
      expense_id: expenseId,
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      discount_pct: String(item.discount_pct),
      iva_rate: item.iva_rate as IvaRate,
      expense_account_code: item.expense_account_code,
      sort_order: item.sort_order ?? index,
      created_by: actorId,
      updated_by: actorId,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      tax_amount: totals.tax_amount,
      total: totals.total,
    })),
    { transaction: t },
  )
  return calculated.totals
}

export async function createExpenseScheduleItems(
  scheduleId: string,
  items: ExpenseLineItemInput[],
  orgId: string,
  actorId: string | null,
  t: Transaction,
) {
  const calculated = calculateExpenseItems(items)
  await ExpenseScheduleItem.bulkCreate(
    calculated.lines.map(({ item, totals }, index) => ({
      org_id: orgId,
      schedule_id: scheduleId,
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      discount_pct: String(item.discount_pct),
      iva_rate: item.iva_rate as IvaRate,
      expense_account_code: item.expense_account_code,
      sort_order: item.sort_order ?? index,
      created_by: actorId,
      updated_by: actorId,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      tax_amount: totals.tax_amount,
      total: totals.total,
    })),
    { transaction: t },
  )
  return calculated.totals
}

export function scheduleItemsToInput(items: ExpenseScheduleItem[]): ExpenseLineItemInput[] {
  return items.map(item => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_pct: Number(item.discount_pct),
    iva_rate: item.iva_rate,
    expense_account_code: item.expense_account_code,
    sort_order: item.sort_order,
  }))
}
