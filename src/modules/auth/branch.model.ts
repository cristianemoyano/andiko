import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'
import Organization from './organization.model'

export interface BranchAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  name: string
  address: string | null
  is_active: boolean
}

type BranchCreationAttributes = Optional<
  BranchAttributes,
  'id' | 'address' | 'is_active' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Branch extends Model<BranchAttributes, BranchCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare name: string
  declare address: string | null
  declare is_active: boolean
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Branch.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:    { type: DataTypes.UUID, allowNull: false },
    name:      { type: DataTypes.STRING(255), allowNull: false },
    address:   { type: DataTypes.STRING(500) },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'branches', paranoid: true, underscored: true }
)

Organization.hasMany(Branch, { foreignKey: 'org_id', as: 'branches' })
Branch.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' })

export default Branch
