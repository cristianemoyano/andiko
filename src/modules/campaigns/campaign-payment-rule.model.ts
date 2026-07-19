import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, PaymentCondition } from '@/types'
import type { PaymentMethod } from '@/modules/sales/payment.constants'
import type { CampaignWallet, CampaignCardBrand, CampaignCardType } from './campaign.constants'

export interface CampaignPaymentRuleAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  campaign_id: UUID
  payment_method: PaymentMethod | null
  payment_condition: PaymentCondition | null
  wallet: CampaignWallet | null
  card_brand: CampaignCardBrand | null
  card_type: CampaignCardType | null
  via_qr: boolean | null
}

type CampaignPaymentRuleCreationAttributes = Optional<
  CampaignPaymentRuleAttributes,
  | 'id' | 'org_id' | 'payment_method' | 'payment_condition' | 'wallet' | 'card_brand' | 'card_type' | 'via_qr'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CampaignPaymentRule extends AuditModel<CampaignPaymentRuleAttributes, CampaignPaymentRuleCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare campaign_id: UUID
  declare payment_method: PaymentMethod | null
  declare payment_condition: PaymentCondition | null
  declare wallet: CampaignWallet | null
  declare card_brand: CampaignCardBrand | null
  declare card_type: CampaignCardType | null
  declare via_qr: boolean | null
}

CampaignPaymentRule.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaign_id:       { type: DataTypes.UUID, allowNull: false },
    payment_method:    { type: DataTypes.STRING(10) },
    payment_condition: { type: DataTypes.STRING(10) },
    wallet:            { type: DataTypes.STRING(24) },
    card_brand:        { type: DataTypes.STRING(16) },
    card_type:         { type: DataTypes.STRING(8) },
    via_qr:            { type: DataTypes.BOOLEAN },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'campaign_payment_rules', paranoid: true, underscored: true }
)

export default CampaignPaymentRule
