import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { Model } from 'sequelize'
import type { UUID, Timestamps } from '@/types'

export interface PosCashSessionAttributes extends Omit<Timestamps, 'deleted_at'> {
  id: UUID
  org_id: UUID
  branch_id: UUID | null
  pos_device_id: UUID | null
  local_id: string | null
  cashier_user_id: UUID | null
  cashier_name: string | null
  opened_at: Date
  closed_at: Date | null
  opening_amount: string
  closing_amount_declared: string | null
  closing_amount_expected: string | null
  difference: string | null
  status: 'open' | 'closed'
  synced_at: Date
}

type PosCashSessionCreationAttributes = Optional<
  PosCashSessionAttributes,
  'id' | 'branch_id' | 'pos_device_id' | 'local_id' | 'cashier_user_id' | 'cashier_name'
  | 'closed_at' | 'closing_amount_declared' | 'closing_amount_expected' | 'difference'
  | 'status' | 'synced_at' | 'created_at' | 'updated_at'
>

class PosCashSession extends Model<PosCashSessionAttributes, PosCashSessionCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID | null
  declare pos_device_id: UUID | null
  declare local_id: string | null
  declare cashier_user_id: UUID | null
  declare cashier_name: string | null
  declare opened_at: Date
  declare closed_at: Date | null
  declare opening_amount: string
  declare closing_amount_declared: string | null
  declare closing_amount_expected: string | null
  declare difference: string | null
  declare status: 'open' | 'closed'
  declare synced_at: Date
  declare created_at: Date
  declare updated_at: Date
}

PosCashSession.init(
  {
    id:                       { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    org_id:                   { type: DataTypes.UUID, allowNull: false },
    branch_id:                { type: DataTypes.UUID },
    pos_device_id:            { type: DataTypes.UUID },
    local_id:                 { type: DataTypes.STRING(64) },
    cashier_user_id:          { type: DataTypes.UUID },
    cashier_name:             { type: DataTypes.STRING(128) },
    opened_at:                { type: DataTypes.DATE, allowNull: false },
    closed_at:                { type: DataTypes.DATE },
    opening_amount:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0' },
    closing_amount_declared:  { type: DataTypes.DECIMAL(15, 2) },
    closing_amount_expected:  { type: DataTypes.DECIMAL(15, 2) },
    difference:               { type: DataTypes.DECIMAL(15, 2) },
    status:                   { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'open' },
    synced_at:                { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    created_at:               { type: DataTypes.DATE, allowNull: false },
    updated_at:               { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'pos_cash_sessions',
    timestamps: true,
    paranoid: false,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
)

export default PosCashSession
