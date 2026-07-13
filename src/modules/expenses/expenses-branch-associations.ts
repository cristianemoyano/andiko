import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import RecurringExpenseTemplate from './recurring-expense-template.model'

let registered = false

export function ensureExpensesBranchAssociations(): void {
  if (registered) return
  registered = true

  Expense.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  ExpensePayment.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  RecurringExpenseTemplate.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })

  Expense.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  ExpensePayment.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  RecurringExpenseTemplate.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
}
