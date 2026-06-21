import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export interface BranchAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  /** Número estable por organización (1…9999), usado en numeración de documentos de venta */
  branch_code: number
  name: string
  address: string | null
  is_active: boolean
  /** Punto de venta AFIP habilitado para esta sucursal (numeración fiscal electrónica) */
  punto_venta: number | null
}

type BranchCreationAttributes = Optional<
  BranchAttributes,
  'id' | 'branch_code' | 'address' | 'is_active' | 'punto_venta' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Branch extends Model<BranchAttributes, BranchCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare branch_code: number
  declare name: string
  declare address: string | null
  declare is_active: boolean
  declare punto_venta: number | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Branch.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:       { type: DataTypes.UUID, allowNull: false },
    branch_code:  { type: DataTypes.INTEGER, allowNull: false },
    name:         { type: DataTypes.STRING(255), allowNull: false },
    address:   { type: DataTypes.STRING(500) },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    punto_venta: { type: DataTypes.SMALLINT },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'branches', paranoid: true, underscored: true }
)

export default Branch
