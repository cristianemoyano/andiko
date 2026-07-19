import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { CampaignTargetKind } from './campaign.constants'

export interface CampaignTargetAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  campaign_id: UUID
  target_kind: CampaignTargetKind
  category_id: UUID | null
  product_id: UUID | null
  variant_id: UUID | null
  is_exclusion: boolean
}

type CampaignTargetCreationAttributes = Optional<
  CampaignTargetAttributes,
  | 'id' | 'org_id' | 'category_id' | 'product_id' | 'variant_id' | 'is_exclusion'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CampaignTarget extends AuditModel<CampaignTargetAttributes, CampaignTargetCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare campaign_id: UUID
  declare target_kind: CampaignTargetKind
  declare category_id: UUID | null
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare is_exclusion: boolean
}

CampaignTarget.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaign_id:  { type: DataTypes.UUID, allowNull: false },
    target_kind:  { type: DataTypes.STRING(10), allowNull: false },
    category_id:  { type: DataTypes.UUID },
    product_id:   { type: DataTypes.UUID },
    variant_id:   { type: DataTypes.UUID },
    is_exclusion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'campaign_targets', paranoid: true, underscored: true }
)

export default CampaignTarget
