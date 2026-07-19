import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { CampaignDocumentType } from './campaign.constants'

export interface CampaignApplicationAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  campaign_id: UUID
  coupon_id: UUID | null
  document_type: CampaignDocumentType
  document_id: UUID
  applied_discount_amount: string
  benefit_snapshot: string | null
  rule_snapshot: Record<string, unknown> | null
  applied_at: Date
}

type CampaignApplicationCreationAttributes = Optional<
  CampaignApplicationAttributes,
  | 'id' | 'org_id' | 'coupon_id' | 'applied_discount_amount' | 'benefit_snapshot' | 'rule_snapshot' | 'applied_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CampaignApplication extends AuditModel<CampaignApplicationAttributes, CampaignApplicationCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare campaign_id: UUID
  declare coupon_id: UUID | null
  declare document_type: CampaignDocumentType
  declare document_id: UUID
  declare applied_discount_amount: string
  declare benefit_snapshot: string | null
  declare rule_snapshot: Record<string, unknown> | null
  declare applied_at: Date
}

CampaignApplication.init(
  {
    id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaign_id:             { type: DataTypes.UUID, allowNull: false },
    coupon_id:               { type: DataTypes.UUID },
    document_type:           { type: DataTypes.STRING(16), allowNull: false },
    document_id:             { type: DataTypes.UUID, allowNull: false },
    applied_discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    benefit_snapshot:        { type: DataTypes.TEXT },
    rule_snapshot:           { type: DataTypes.JSONB },
    applied_at:              { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'campaign_applications', paranoid: true, underscored: true }
)

export default CampaignApplication
