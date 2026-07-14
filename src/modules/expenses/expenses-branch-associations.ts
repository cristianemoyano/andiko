import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import ExpenseSchedule from './expense-schedule.model'
import ExpenseInstallment from './expense-installment.model'

let registered = false

export function ensureExpensesBranchAssociations(): void {
  if (registered) return
  registered = true

  Expense.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  ExpensePayment.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  ExpenseSchedule.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })

  Expense.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  ExpensePayment.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  ExpenseSchedule.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

  if (!Expense.associations.installments) {
    Expense.hasMany(ExpenseInstallment, { foreignKey: 'expense_id', as: 'installments' })
    ExpenseInstallment.belongsTo(Expense, { foreignKey: 'expense_id', as: 'expense' })
  }
  if (!ExpenseInstallment.associations.payment) {
    ExpenseInstallment.belongsTo(ExpensePayment, { foreignKey: 'expense_payment_id', as: 'payment' })
    ExpensePayment.hasMany(ExpenseInstallment, { foreignKey: 'expense_payment_id', as: 'installments' })
  }
}
