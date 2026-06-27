import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { OrgModuleKey } from '@/modules/auth/organization-modules'
import BillingPlan from './billing-plan.model'

export interface BillingPlanModuleAttributes extends Timestamps, AuditFields {
  id: UUID
  plan_id: UUID
  module_key: OrgModuleKey
  included: boolean
  addon_price: string
}

type BillingPlanModuleCreationAttributes = Optional<
  BillingPlanModuleAttributes,
  | 'id' | 'included' | 'addon_price'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingPlanModule extends AuditModel<BillingPlanModuleAttributes, BillingPlanModuleCreationAttributes> {
  declare id: UUID
  declare plan_id: UUID
  declare module_key: OrgModuleKey
  declare included: boolean
  declare addon_price: string
}

BillingPlanModule.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_id:     { type: DataTypes.UUID, allowNull: false },
    module_key:  { type: DataTypes.STRING(40), allowNull: false },
    included:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    addon_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_plan_modules', paranoid: true, underscored: true }
)

BillingPlanModule.belongsTo(BillingPlan, { foreignKey: 'plan_id', as: 'plan' })
BillingPlan.hasMany(BillingPlanModule, { foreignKey: 'plan_id', as: 'modules' })

export default BillingPlanModule
