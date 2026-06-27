import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { OrgModuleKey } from '@/modules/auth/organization-modules'
import OrgSubscription from './org-subscription.model'

export interface SubscriptionAddonAttributes extends Timestamps, AuditFields {
  id: UUID
  subscription_id: UUID
  module_key: OrgModuleKey
  unit_price: string
  enabled: boolean
}

type SubscriptionAddonCreationAttributes = Optional<
  SubscriptionAddonAttributes,
  | 'id' | 'unit_price' | 'enabled'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class SubscriptionAddon extends AuditModel<SubscriptionAddonAttributes, SubscriptionAddonCreationAttributes> {
  declare id: UUID
  declare subscription_id: UUID
  declare module_key: OrgModuleKey
  declare unit_price: string
  declare enabled: boolean
}

SubscriptionAddon.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id: { type: DataTypes.UUID, allowNull: false },
    module_key:      { type: DataTypes.STRING(40), allowNull: false },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    enabled:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'subscription_addons', paranoid: true, underscored: true }
)

SubscriptionAddon.belongsTo(OrgSubscription, { foreignKey: 'subscription_id', as: 'subscription' })
OrgSubscription.hasMany(SubscriptionAddon, { foreignKey: 'subscription_id', as: 'addons' })

export default SubscriptionAddon
