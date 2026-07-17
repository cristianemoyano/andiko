import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { ACCOUNTING_PERIOD_STATUSES, type AccountingPeriodStatus } from './accounting-period.constants'

export interface AccountingPeriodAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  start_date: string
  end_date: string
  status: AccountingPeriodStatus
  closing_entry_id: UUID | null
  reversal_entry_id: UUID | null
  notes: string | null
}

type AccountingPeriodCreationAttributes = Optional<
  AccountingPeriodAttributes,
  | 'id' | 'status' | 'closing_entry_id' | 'reversal_entry_id' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class AccountingPeriod extends AuditModel<AccountingPeriodAttributes, AccountingPeriodCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare start_date: string
  declare end_date: string
  declare status: AccountingPeriodStatus
  declare closing_entry_id: UUID | null
  declare reversal_entry_id: UUID | null
  declare notes: string | null
}

AccountingPeriod.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    start_date:        { type: DataTypes.DATEONLY, allowNull: false },
    end_date:          { type: DataTypes.DATEONLY, allowNull: false },
    status:            { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'closed', validate: { isIn: [[...ACCOUNTING_PERIOD_STATUSES]] } },
    closing_entry_id:  { type: DataTypes.UUID },
    reversal_entry_id: { type: DataTypes.UUID },
    notes:             { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'accounting_periods', paranoid: true, underscored: true }
)

export default AccountingPeriod
