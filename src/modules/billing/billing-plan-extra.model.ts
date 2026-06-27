import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { BillingExtraKey } from './billing-extras'
import BillingPlan from './billing-plan.model'

export interface BillingPlanExtraAttributes extends Timestamps, AuditFields {
  id: UUID
  plan_id: UUID
  extra_key: BillingExtraKey
  included: boolean
  addon_price: string
}

type BillingPlanExtraCreationAttributes = Optional<
  BillingPlanExtraAttributes,
  | 'id' | 'included' | 'addon_price'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingPlanExtra extends AuditModel<BillingPlanExtraAttributes, BillingPlanExtraCreationAttributes> {
  declare id: UUID
  declare plan_id: UUID
  declare extra_key: BillingExtraKey
  declare included: boolean
  declare addon_price: string
}

BillingPlanExtra.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_id:     { type: DataTypes.UUID, allowNull: false },
    extra_key:   { type: DataTypes.STRING(40), allowNull: false },
    included:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    addon_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_plan_extras', paranoid: true, underscored: true }
)

BillingPlanExtra.belongsTo(BillingPlan, { foreignKey: 'plan_id', as: 'plan' })
BillingPlan.hasMany(BillingPlanExtra, { foreignKey: 'plan_id', as: 'extras' })

export default BillingPlanExtra
