import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'

export const RECURRING_EXPENSE_FREQUENCIES = ['monthly', 'weekly'] as const
export type RecurringExpenseFrequency = typeof RECURRING_EXPENSE_FREQUENCIES[number]

export interface RecurringExpenseTemplateAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID
  contact_id: UUID
  description: string
  expense_account_code: string
  default_amount: string
  iva_rate: IvaRate
  frequency: RecurringExpenseFrequency
  next_run_date: Date
  is_active: boolean
}

type RecurringExpenseTemplateCreationAttributes = Optional<
  RecurringExpenseTemplateAttributes,
  | 'id' | 'iva_rate' | 'frequency' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class RecurringExpenseTemplate extends AuditModel<
  RecurringExpenseTemplateAttributes,
  RecurringExpenseTemplateCreationAttributes
> {
  declare id: UUID
  declare branch_id: UUID
  declare contact_id: UUID
  declare description: string
  declare expense_account_code: string
  declare default_amount: string
  declare iva_rate: IvaRate
  declare frequency: RecurringExpenseFrequency
  declare next_run_date: Date
  declare is_active: boolean
}

RecurringExpenseTemplate.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:             { type: DataTypes.UUID, allowNull: false },
    contact_id:            { type: DataTypes.UUID, allowNull: false },
    description:           { type: DataTypes.STRING(500), allowNull: false },
    expense_account_code:  { type: DataTypes.STRING(20), allowNull: false },
    default_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    iva_rate:              { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    frequency:             { type: DataTypes.ENUM(...RECURRING_EXPENSE_FREQUENCIES), allowNull: false, defaultValue: 'monthly' },
    next_run_date:         { type: DataTypes.DATE, allowNull: false },
    is_active:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'recurring_expense_templates', paranoid: true, underscored: true },
)

export default RecurringExpenseTemplate
