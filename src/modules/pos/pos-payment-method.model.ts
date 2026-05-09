import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'
import { Branch } from '@/modules/auth/branch.model'

export const POS_PAYMENT_METHOD_TYPES = [
  'cash',
  'card',
  'transfer',
  'qr',
  'current_account',
  'check',
  'other',
] as const
export type PosPaymentMethodType = typeof POS_PAYMENT_METHOD_TYPES[number]

export interface PosPaymentMethodAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  name: string
  type: PosPaymentMethodType
  requires_reference: boolean
  config: Record<string, unknown>
  is_active: boolean
  sort_order: number
}

type PosPaymentMethodCreationAttributes = Optional<
  PosPaymentMethodAttributes,
  'id' | 'requires_reference' | 'config' | 'is_active' | 'sort_order' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class PosPaymentMethod extends Model<PosPaymentMethodAttributes, PosPaymentMethodCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare name: string
  declare type: PosPaymentMethodType
  declare requires_reference: boolean
  declare config: Record<string, unknown>
  declare is_active: boolean
  declare sort_order: number
}

PosPaymentMethod.init(
  {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:              { type: DataTypes.UUID, allowNull: false },
    name:                { type: DataTypes.STRING(128), allowNull: false },
    type:                { type: DataTypes.STRING(64), allowNull: false },
    requires_reference:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    config:              { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    is_active:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order:          { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    created_at:          { type: DataTypes.DATE },
    updated_at:          { type: DataTypes.DATE },
    deleted_at:          { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'pos_payment_methods', paranoid: true, underscored: true }
)

// ---------------------------------------------------------------------------

export interface PosBranchPaymentMethodAttributes {
  id: UUID
  org_id: UUID
  branch_id: UUID
  pos_payment_method_id: UUID
  is_active: boolean
  sort_order: number
  created_at?: Date
  updated_at?: Date
}

type PosBranchPaymentMethodCreationAttributes = Optional<
  PosBranchPaymentMethodAttributes,
  'id' | 'is_active' | 'sort_order' | 'created_at' | 'updated_at'
>

export class PosBranchPaymentMethod extends Model<
  PosBranchPaymentMethodAttributes,
  PosBranchPaymentMethodCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID
  declare pos_payment_method_id: UUID
  declare is_active: boolean
  declare sort_order: number
}

PosBranchPaymentMethod.init(
  {
    id:                     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:                 { type: DataTypes.UUID, allowNull: false },
    branch_id:              { type: DataTypes.UUID, allowNull: false },
    pos_payment_method_id:  { type: DataTypes.UUID, allowNull: false },
    is_active:              { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order:             { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    created_at:             { type: DataTypes.DATE },
    updated_at:             { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'pos_branch_payment_methods', underscored: true, paranoid: false }
)

// Associations
PosPaymentMethod.hasMany(PosBranchPaymentMethod, {
  foreignKey: 'pos_payment_method_id',
  as: 'branchAssignments',
})
PosBranchPaymentMethod.belongsTo(PosPaymentMethod, {
  foreignKey: 'pos_payment_method_id',
  as: 'paymentMethod',
})

Branch.hasMany(PosBranchPaymentMethod, {
  foreignKey: 'branch_id',
  as: 'branchPaymentMethodAssignments',
})
PosBranchPaymentMethod.belongsTo(Branch, {
  foreignKey: 'branch_id',
  as: 'branch',
})
