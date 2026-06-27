import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { BillingExtraKey } from './billing-extras'
import OrgSubscription from './org-subscription.model'

export interface SubscriptionExtraAttributes extends Timestamps, AuditFields {
  id: UUID
  subscription_id: UUID
  extra_key: BillingExtraKey
  unit_price: string
  enabled: boolean
}

type SubscriptionExtraCreationAttributes = Optional<
  SubscriptionExtraAttributes,
  | 'id' | 'unit_price' | 'enabled'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class SubscriptionExtra extends AuditModel<SubscriptionExtraAttributes, SubscriptionExtraCreationAttributes> {
  declare id: UUID
  declare subscription_id: UUID
  declare extra_key: BillingExtraKey
  declare unit_price: string
  declare enabled: boolean
}

SubscriptionExtra.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id: { type: DataTypes.UUID, allowNull: false },
    extra_key:       { type: DataTypes.STRING(40), allowNull: false },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    enabled:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'subscription_extras', paranoid: true, underscored: true }
)

SubscriptionExtra.belongsTo(OrgSubscription, { foreignKey: 'subscription_id', as: 'subscription' })
OrgSubscription.hasMany(SubscriptionExtra, { foreignKey: 'subscription_id', as: 'extras' })

export default SubscriptionExtra
