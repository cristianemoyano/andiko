import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'

export const EXPENSE_SCHEDULE_KINDS = ['recurring'] as const
export type ExpenseScheduleKind = typeof EXPENSE_SCHEDULE_KINDS[number]

export const EXPENSE_SCHEDULE_FREQUENCIES = ['monthly', 'bimonthly', 'weekly'] as const
export type ExpenseScheduleFrequency = typeof EXPENSE_SCHEDULE_FREQUENCIES[number]

/** @deprecated Use ExpenseScheduleFrequency */
export type RecurringExpenseFrequency = ExpenseScheduleFrequency
/** @deprecated Use EXPENSE_SCHEDULE_FREQUENCIES */
export const RECURRING_EXPENSE_FREQUENCIES = EXPENSE_SCHEDULE_FREQUENCIES

export interface ExpenseScheduleAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID
  contact_id: UUID
  kind: ExpenseScheduleKind
  description: string
  expense_account_code: string
  default_amount: string
  iva_rate: IvaRate
  frequency: ExpenseScheduleFrequency
  next_run_date: Date
  is_active: boolean
}

type ExpenseScheduleCreationAttributes = Optional<
  ExpenseScheduleAttributes,
  | 'id' | 'kind' | 'iva_rate' | 'frequency' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ExpenseSchedule extends AuditModel<
  ExpenseScheduleAttributes,
  ExpenseScheduleCreationAttributes
> {
  declare id: UUID
  declare branch_id: UUID
  declare contact_id: UUID
  declare kind: ExpenseScheduleKind
  declare description: string
  declare expense_account_code: string
  declare default_amount: string
  declare iva_rate: IvaRate
  declare frequency: ExpenseScheduleFrequency
  declare next_run_date: Date
  declare is_active: boolean
}

ExpenseSchedule.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:             { type: DataTypes.UUID, allowNull: false },
    contact_id:            { type: DataTypes.UUID, allowNull: false },
    kind:                  { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'recurring' },
    description:           { type: DataTypes.STRING(500), allowNull: false },
    expense_account_code:  { type: DataTypes.STRING(20), allowNull: false },
    default_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    iva_rate:              { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    frequency:             {
      // DB column uses PG enum `recurring_expense_frequency` (from original migration).
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'monthly',
    },
    next_run_date:         { type: DataTypes.DATE, allowNull: false },
    is_active:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'expense_schedules', paranoid: true, underscored: true },
)

/** @deprecated Prefer ExpenseSchedule — table renamed from recurring_expense_templates */
export const RecurringExpenseTemplate = ExpenseSchedule
export type RecurringExpenseTemplate = ExpenseSchedule
export type RecurringExpenseTemplateAttributes = ExpenseScheduleAttributes

export default ExpenseSchedule
