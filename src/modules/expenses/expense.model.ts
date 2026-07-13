import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import User from '@/modules/auth/user.model'
import RecurringExpenseTemplate from './recurring-expense-template.model'

export const EXPENSE_STATUSES = ['draft', 'received', 'partially_paid', 'paid', 'cancelled'] as const
export type ExpenseStatus = typeof EXPENSE_STATUSES[number]

export { OPEN_PAYABLE_EXPENSE_STATUSES } from './expense.constants'

export interface ExpenseAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  recurring_template_id: UUID | null
  buyer_id: UUID | null
  expense_number: string
  description: string
  expense_account_code: string
  invoice_number: string | null
  status: ExpenseStatus
  invoice_date: Date | null
  due_date: Date | null
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  notes: string | null
}

type ExpenseCreationAttributes = Optional<
  ExpenseAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'recurring_template_id' | 'buyer_id'
  | 'invoice_number' | 'status' | 'invoice_date' | 'due_date' | 'currency'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'paid_amount' | 'balance'
  | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Expense extends AuditModel<ExpenseAttributes, ExpenseCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare recurring_template_id: UUID | null
  declare buyer_id: UUID | null
  declare expense_number: string
  declare description: string
  declare expense_account_code: string
  declare invoice_number: string | null
  declare status: ExpenseStatus
  declare invoice_date: Date | null
  declare due_date: Date | null
  declare currency: string
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare paid_amount: string
  declare balance: string
  declare notes: string | null
}

Expense.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:             { type: DataTypes.UUID },
    contact_id:            { type: DataTypes.UUID },
    recurring_template_id: { type: DataTypes.UUID },
    buyer_id:              { type: DataTypes.UUID },
    expense_number:        { type: DataTypes.STRING(20), allowNull: false },
    description:           { type: DataTypes.STRING(500), allowNull: false },
    expense_account_code:  { type: DataTypes.STRING(20), allowNull: false },
    invoice_number:        { type: DataTypes.STRING(50) },
    status:                { type: DataTypes.ENUM(...EXPENSE_STATUSES), allowNull: false, defaultValue: 'draft' },
    invoice_date:          { type: DataTypes.DATE },
    due_date:              { type: DataTypes.DATE },
    currency:              { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:              { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:            { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:                 { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    paid_amount:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    balance:               { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:                 { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'expenses', paranoid: true, underscored: true },
)

RecurringExpenseTemplate.hasMany(Expense, { foreignKey: 'recurring_template_id', as: 'expenses' })
Expense.belongsTo(RecurringExpenseTemplate, { foreignKey: 'recurring_template_id', as: 'recurringTemplate' })

Expense.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
User.hasMany(Expense, { foreignKey: 'buyer_id', as: 'expenses' })

export default Expense
