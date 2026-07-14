import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const EXPENSE_INSTALLMENT_STATUSES = ['pending', 'paid', 'cancelled'] as const
export type ExpenseInstallmentStatus = typeof EXPENSE_INSTALLMENT_STATUSES[number]

export interface ExpenseInstallmentAttributes extends Timestamps, AuditFields {
  id: UUID
  expense_id: UUID
  installment_number: number
  due_date: Date
  amount: string
  status: ExpenseInstallmentStatus
  expense_payment_id: UUID | null
  paid_at: Date | null
}

type ExpenseInstallmentCreationAttributes = Optional<
  ExpenseInstallmentAttributes,
  | 'id' | 'status' | 'expense_payment_id' | 'paid_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ExpenseInstallment extends AuditModel<
  ExpenseInstallmentAttributes,
  ExpenseInstallmentCreationAttributes
> {
  declare id: UUID
  declare expense_id: UUID
  declare installment_number: number
  declare due_date: Date
  declare amount: string
  declare status: ExpenseInstallmentStatus
  declare expense_payment_id: UUID | null
  declare paid_at: Date | null
}

ExpenseInstallment.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    expense_id:         { type: DataTypes.UUID, allowNull: false },
    installment_number: { type: DataTypes.INTEGER, allowNull: false },
    due_date:           { type: DataTypes.DATE, allowNull: false },
    amount:             { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    status:             {
      // DB column uses PG enum `expense_installment_status` from migration.
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    expense_payment_id: { type: DataTypes.UUID },
    paid_at:            { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'expense_installments', paranoid: true, underscored: true },
)

export default ExpenseInstallment
