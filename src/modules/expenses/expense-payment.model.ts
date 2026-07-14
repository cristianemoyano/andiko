import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Expense from './expense.model'
import User from '@/modules/auth/user.model'

export interface ExpensePaymentAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  expense_id: UUID
  contact_id: UUID | null
  buyer_id: UUID | null
  payment_number: string
  payment_date: Date
  amount: string
  payment_method: string
  notes: string | null
}

type ExpensePaymentCreationAttributes = Optional<
  ExpensePaymentAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'buyer_id' | 'payment_method' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ExpensePayment extends AuditModel<ExpensePaymentAttributes, ExpensePaymentCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare expense_id: UUID
  declare contact_id: UUID | null
  declare buyer_id: UUID | null
  declare payment_number: string
  declare payment_date: Date
  declare amount: string
  declare payment_method: string
  declare notes: string | null
}

ExpensePayment.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:      { type: DataTypes.UUID },
    expense_id:     { type: DataTypes.UUID, allowNull: false },
    contact_id:     { type: DataTypes.UUID },
    buyer_id:       { type: DataTypes.UUID },
    payment_number: { type: DataTypes.STRING(20), allowNull: false },
    payment_date:   { type: DataTypes.DATE, allowNull: false },
    amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    payment_method: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'transfer' },
    notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'expense_payments', paranoid: true, underscored: true },
)

Expense.hasMany(ExpensePayment, { foreignKey: 'expense_id', as: 'payments' })
ExpensePayment.belongsTo(Expense, { foreignKey: 'expense_id', as: 'expense' })

ExpensePayment.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
User.hasMany(ExpensePayment, { foreignKey: 'buyer_id', as: 'expensePayments' })

export default ExpensePayment
