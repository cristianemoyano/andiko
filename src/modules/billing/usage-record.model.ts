import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import OrgSubscription from './org-subscription.model'

export interface UsageRecordAttributes extends Timestamps, AuditFields {
  id: UUID
  subscription_id: UUID | null
  metric_key: string
  quantity: string
  period: string
  recorded_at: Date
  invoiced_at: Date | null
}

type UsageRecordCreationAttributes = Optional<
  UsageRecordAttributes,
  | 'id' | 'subscription_id' | 'recorded_at' | 'invoiced_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class UsageRecord extends AuditModel<UsageRecordAttributes, UsageRecordCreationAttributes> {
  declare id: UUID
  declare subscription_id: UUID | null
  declare metric_key: string
  declare quantity: string
  declare period: string
  declare recorded_at: Date
  declare invoiced_at: Date | null
}

UsageRecord.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id: { type: DataTypes.UUID },
    metric_key:      { type: DataTypes.STRING(50), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0.0000' },
    period:          { type: DataTypes.DATEONLY, allowNull: false },
    recorded_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    invoiced_at:     { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'usage_records', paranoid: true, underscored: true }
)

UsageRecord.belongsTo(OrgSubscription, { foreignKey: 'subscription_id', as: 'subscription' })
OrgSubscription.hasMany(UsageRecord, { foreignKey: 'subscription_id', as: 'usageRecords' })

export default UsageRecord
