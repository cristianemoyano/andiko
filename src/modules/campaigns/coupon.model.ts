import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export interface CouponAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  campaign_id: UUID
  code: string
  max_redemptions: number | null
  redeemed_count: number
  per_customer_limit: number | null
  is_active: boolean
}

type CouponCreationAttributes = Optional<
  CouponAttributes,
  | 'id' | 'org_id' | 'max_redemptions' | 'redeemed_count' | 'per_customer_limit' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Coupon extends AuditModel<CouponAttributes, CouponCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare campaign_id: UUID
  declare code: string
  declare max_redemptions: number | null
  declare redeemed_count: number
  declare per_customer_limit: number | null
  declare is_active: boolean
}

Coupon.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaign_id:        { type: DataTypes.UUID, allowNull: false },
    code:               { type: DataTypes.STRING(40), allowNull: false },
    max_redemptions:    { type: DataTypes.INTEGER },
    redeemed_count:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    per_customer_limit: { type: DataTypes.INTEGER },
    is_active:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'coupons', paranoid: true, underscored: true }
)

export default Coupon
