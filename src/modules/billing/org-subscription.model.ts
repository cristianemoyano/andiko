import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, SubscriptionStatus } from '@/types'
import { SUBSCRIPTION_STATUSES } from '@/types'
import BillingPlan from './billing-plan.model'

export interface OrgSubscriptionAttributes extends Timestamps, AuditFields {
  id: UUID
  plan_id: UUID
  status: SubscriptionStatus
  seats: number
  billing_day: number
  current_period_start: Date | null
  current_period_end: Date | null
  trial_end: Date | null
  started_at: Date | null
  cancelled_at: Date | null
  notes: string | null
}

type OrgSubscriptionCreationAttributes = Optional<
  OrgSubscriptionAttributes,
  | 'id' | 'status' | 'seats' | 'billing_day' | 'current_period_start' | 'current_period_end'
  | 'trial_end' | 'started_at' | 'cancelled_at' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class OrgSubscription extends AuditModel<OrgSubscriptionAttributes, OrgSubscriptionCreationAttributes> {
  declare id: UUID
  declare plan_id: UUID
  declare status: SubscriptionStatus
  declare seats: number
  declare billing_day: number
  declare current_period_start: Date | null
  declare current_period_end: Date | null
  declare trial_end: Date | null
  declare started_at: Date | null
  declare cancelled_at: Date | null
  declare notes: string | null
}

OrgSubscription.init(
  {
    id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_id:              { type: DataTypes.UUID, allowNull: false },
    status:               { type: DataTypes.ENUM(...SUBSCRIPTION_STATUSES), allowNull: false, defaultValue: 'trialing' },
    seats:                { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    billing_day:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    current_period_start: { type: DataTypes.DATE },
    current_period_end:   { type: DataTypes.DATE },
    trial_end:            { type: DataTypes.DATE },
    started_at:           { type: DataTypes.DATE },
    cancelled_at:         { type: DataTypes.DATE },
    notes:                { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'org_subscriptions', paranoid: true, underscored: true }
)

OrgSubscription.belongsTo(BillingPlan, { foreignKey: 'plan_id', as: 'plan' })
BillingPlan.hasMany(OrgSubscription, { foreignKey: 'plan_id', as: 'subscriptions' })

export default OrgSubscription
