import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import OrgSubscription from './org-subscription.model'

export interface SubscriptionMetricAllowanceAttributes extends Timestamps, AuditFields {
  id: UUID
  subscription_id: UUID
  metric_key: string
  extra_included_quantity: string
}

type SubscriptionMetricAllowanceCreationAttributes = Optional<
  SubscriptionMetricAllowanceAttributes,
  | 'id' | 'extra_included_quantity'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class SubscriptionMetricAllowance extends AuditModel<
  SubscriptionMetricAllowanceAttributes,
  SubscriptionMetricAllowanceCreationAttributes
> {
  declare id: UUID
  declare subscription_id: UUID
  declare metric_key: string
  declare extra_included_quantity: string
}

SubscriptionMetricAllowance.init(
  {
    id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id:         { type: DataTypes.UUID, allowNull: false },
    metric_key:              { type: DataTypes.STRING(50), allowNull: false },
    extra_included_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0.0000' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'subscription_metric_allowances', paranoid: true, underscored: true },
)

SubscriptionMetricAllowance.belongsTo(OrgSubscription, { foreignKey: 'subscription_id', as: 'subscription' })
OrgSubscription.hasMany(SubscriptionMetricAllowance, { foreignKey: 'subscription_id', as: 'metric_allowances' })

export default SubscriptionMetricAllowance
