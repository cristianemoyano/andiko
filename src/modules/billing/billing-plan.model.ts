import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, BillingInterval } from '@/types'
import { BILLING_INTERVALS } from '@/types'

export interface BillingPlanAttributes extends Timestamps, AuditFields {
  id: UUID
  code: string
  name: string
  description: string | null
  currency: string
  interval: BillingInterval
  base_price: string
  included_seats: number
  per_seat_price: string
  included_branches: number
  per_branch_price: string
  included_sites: number
  per_site_price: string
  is_active: boolean
}

type BillingPlanCreationAttributes = Optional<
  BillingPlanAttributes,
  | 'id' | 'description' | 'currency' | 'interval' | 'base_price' | 'included_seats'
  | 'per_seat_price' | 'included_branches' | 'per_branch_price'
  | 'included_sites' | 'per_site_price' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingPlan extends AuditModel<BillingPlanAttributes, BillingPlanCreationAttributes> {
  declare id: UUID
  declare code: string
  declare name: string
  declare description: string | null
  declare currency: string
  declare interval: BillingInterval
  declare base_price: string
  declare included_seats: number
  declare per_seat_price: string
  declare included_branches: number
  declare per_branch_price: string
  declare included_sites: number
  declare per_site_price: string
  declare is_active: boolean
}

BillingPlan.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code:           { type: DataTypes.STRING(50), allowNull: false },
    name:           { type: DataTypes.STRING(255), allowNull: false },
    description:    { type: DataTypes.TEXT },
    currency:       { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    interval:       { type: DataTypes.ENUM(...BILLING_INTERVALS), allowNull: false, defaultValue: 'monthly' },
    base_price:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    included_seats:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    per_seat_price:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    included_branches:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    per_branch_price:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    included_sites:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    per_site_price:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    is_active:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_plans', paranoid: true, underscored: true }
)

export default BillingPlan
