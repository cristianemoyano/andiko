import 'server-only'
import type { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import ExpenseInstallment from './expense-installment.model'

export async function listInstallmentsForExpense(
  expenseId: string,
  orgId: string,
  t?: Transaction,
) {
  return ExpenseInstallment.findAll({
    where: { expense_id: expenseId, org_id: orgId, deleted_at: null },
    order: [['installment_number', 'ASC']],
    transaction: t,
  })
}

export async function findPendingInstallmentsByIds(
  expenseId: string,
  orgId: string,
  ids: string[],
  t: Transaction,
) {
  return ExpenseInstallment.findAll({
    where: {
      id: { [Op.in]: ids },
      expense_id: expenseId,
      org_id: orgId,
      status: 'pending',
      deleted_at: null,
    },
    transaction: t,
    lock: true,
  })
}
