import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { CampaignDocumentType } from './campaign.constants'

export interface CouponRedemptionAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  coupon_id: UUID
  campaign_id: UUID
  contact_id: UUID | null
  document_type: CampaignDocumentType
  document_id: UUID
  discount_amount: string
  redeemed_at: Date
}

type CouponRedemptionCreationAttributes = Optional<
  CouponRedemptionAttributes,
  | 'id' | 'org_id' | 'contact_id' | 'discount_amount' | 'redeemed_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CouponRedemption extends AuditModel<CouponRedemptionAttributes, CouponRedemptionCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare coupon_id: UUID
  declare campaign_id: UUID
  declare contact_id: UUID | null
  declare document_type: CampaignDocumentType
  declare document_id: UUID
  declare discount_amount: string
  declare redeemed_at: Date
}

CouponRedemption.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    coupon_id:       { type: DataTypes.UUID, allowNull: false },
    campaign_id:     { type: DataTypes.UUID, allowNull: false },
    contact_id:      { type: DataTypes.UUID },
    document_type:   { type: DataTypes.STRING(16), allowNull: false },
    document_id:     { type: DataTypes.UUID, allowNull: false },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    redeemed_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'coupon_redemptions', paranoid: true, underscored: true }
)

export default CouponRedemption
