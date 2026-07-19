import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { CampaignRewardKind, CampaignChannel } from './campaign.constants'

export interface CampaignAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  name: string
  description: string | null
  terms: string | null
  reward_kind: CampaignRewardKind
  reward_percent: string | null
  reward_amount: string | null
  buy_qty: string | null
  get_qty: string | null
  installments_count: number | null
  installments_interest_free: boolean | null
  requires_coupon: boolean
  stackable: boolean
  priority: number
  min_purchase_amount: string | null
  valid_from: Date
  valid_to: Date
  active_weekdays: number[] | null
  active_time_from: string | null
  active_time_to: string | null
  channels: CampaignChannel[] | null
  is_active: boolean
  max_uses: number | null
  uses_count: number
}

type CampaignCreationAttributes = Optional<
  CampaignAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'description' | 'terms'
  | 'reward_percent' | 'reward_amount' | 'buy_qty' | 'get_qty' | 'installments_count' | 'installments_interest_free'
  | 'requires_coupon' | 'stackable' | 'priority' | 'min_purchase_amount'
  | 'active_weekdays' | 'active_time_from' | 'active_time_to' | 'channels'
  | 'is_active' | 'max_uses' | 'uses_count'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Campaign extends AuditModel<CampaignAttributes, CampaignCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare name: string
  declare description: string | null
  declare terms: string | null
  declare reward_kind: CampaignRewardKind
  declare reward_percent: string | null
  declare reward_amount: string | null
  declare buy_qty: string | null
  declare get_qty: string | null
  declare installments_count: number | null
  declare installments_interest_free: boolean | null
  declare requires_coupon: boolean
  declare stackable: boolean
  declare priority: number
  declare min_purchase_amount: string | null
  declare valid_from: Date
  declare valid_to: Date
  declare active_weekdays: number[] | null
  declare active_time_from: string | null
  declare active_time_to: string | null
  declare channels: CampaignChannel[] | null
  declare is_active: boolean
  declare max_uses: number | null
  declare uses_count: number
}

Campaign.init(
  {
    id:                         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:                  { type: DataTypes.UUID },
    name:                       { type: DataTypes.STRING(120), allowNull: false },
    description:                { type: DataTypes.TEXT },
    terms:                      { type: DataTypes.TEXT },
    reward_kind:                { type: DataTypes.STRING(16), allowNull: false },
    reward_percent:             { type: DataTypes.DECIMAL(5, 2) },
    reward_amount:              { type: DataTypes.DECIMAL(15, 2) },
    buy_qty:                    { type: DataTypes.DECIMAL(15, 4) },
    get_qty:                    { type: DataTypes.DECIMAL(15, 4) },
    installments_count:         { type: DataTypes.SMALLINT },
    installments_interest_free: { type: DataTypes.BOOLEAN },
    requires_coupon:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    stackable:                  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    priority:                   { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 100 },
    min_purchase_amount:        { type: DataTypes.DECIMAL(15, 2) },
    valid_from:                 { type: DataTypes.DATE, allowNull: false },
    valid_to:                   { type: DataTypes.DATE, allowNull: false },
    active_weekdays:            { type: DataTypes.ARRAY(DataTypes.SMALLINT) },
    active_time_from:           { type: DataTypes.TIME },
    active_time_to:             { type: DataTypes.TIME },
    channels:                   { type: DataTypes.ARRAY(DataTypes.STRING(10)) },
    is_active:                  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    max_uses:                   { type: DataTypes.INTEGER },
    uses_count:                 { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'campaigns', paranoid: true, underscored: true }
)

export default Campaign
