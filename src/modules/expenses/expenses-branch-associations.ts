import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import ExpenseSchedule from './expense-schedule.model'
import ExpenseInstallment from './expense-installment.model'
import ExpenseItem from './expense-item.model'
import ExpenseScheduleItem from './expense-schedule-item.model'
import CreditCard from './credit-card.model'
import CreditCardStatement from './credit-card-statement.model'

let registered = false

export function ensureExpensesBranchAssociations(): void {
  if (registered) return
  registered = true

  Expense.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  ExpensePayment.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  ExpenseSchedule.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  CreditCard.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })

  Expense.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  ExpensePayment.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  ExpenseSchedule.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  CreditCard.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

  if (!Expense.associations.installments) {
    Expense.hasMany(ExpenseInstallment, { foreignKey: 'expense_id', as: 'installments' })
    ExpenseInstallment.belongsTo(Expense, { foreignKey: 'expense_id', as: 'expense' })
  }
  if (!Expense.associations.items) {
    Expense.hasMany(ExpenseItem, { foreignKey: 'expense_id', as: 'items' })
    ExpenseItem.belongsTo(Expense, { foreignKey: 'expense_id', as: 'expense' })
  }
  if (!ExpenseSchedule.associations.items) {
    ExpenseSchedule.hasMany(ExpenseScheduleItem, { foreignKey: 'schedule_id', as: 'items' })
    ExpenseScheduleItem.belongsTo(ExpenseSchedule, { foreignKey: 'schedule_id', as: 'schedule' })
  }
  if (!ExpenseInstallment.associations.payment) {
    ExpenseInstallment.belongsTo(ExpensePayment, { foreignKey: 'expense_payment_id', as: 'payment' })
    ExpensePayment.hasMany(ExpenseInstallment, { foreignKey: 'expense_payment_id', as: 'installments' })
  }
  if (!CreditCardStatement.associations.expense) {
    CreditCardStatement.belongsTo(Expense, { foreignKey: 'expense_id', as: 'expense' })
    Expense.hasOne(CreditCardStatement, { foreignKey: 'expense_id', as: 'credit_card_statement' })
  }
}
