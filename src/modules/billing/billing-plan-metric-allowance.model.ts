import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import BillingPlan from './billing-plan.model'

export interface BillingPlanMetricAllowanceAttributes extends Timestamps, AuditFields {
  id: UUID
  plan_id: UUID
  metric_key: string
  included_quantity: string
  unit_price: string
}

type BillingPlanMetricAllowanceCreationAttributes = Optional<
  BillingPlanMetricAllowanceAttributes,
  | 'id' | 'included_quantity'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingPlanMetricAllowance extends AuditModel<
  BillingPlanMetricAllowanceAttributes,
  BillingPlanMetricAllowanceCreationAttributes
> {
  declare id: UUID
  declare plan_id: UUID
  declare metric_key: string
  declare included_quantity: string
  declare unit_price: string
}

BillingPlanMetricAllowance.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_id:           { type: DataTypes.UUID, allowNull: false },
    metric_key:        { type: DataTypes.STRING(50), allowNull: false },
    included_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0.0000' },
    unit_price:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_plan_metric_allowances', paranoid: true, underscored: true },
)

BillingPlanMetricAllowance.belongsTo(BillingPlan, { foreignKey: 'plan_id', as: 'plan' })
BillingPlan.hasMany(BillingPlanMetricAllowance, { foreignKey: 'plan_id', as: 'metric_allowances' })

export default BillingPlanMetricAllowance
