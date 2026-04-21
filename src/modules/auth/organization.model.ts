import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export interface OrganizationAttributes extends Timestamps {
  id: UUID
  name: string
  slug: string
  is_active: boolean
}

type OrganizationCreationAttributes = Optional<
  OrganizationAttributes,
  'id' | 'is_active' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> {
  declare id: UUID
  declare name: string
  declare slug: string
  declare is_active: boolean
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Organization.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:      { type: DataTypes.STRING(255), allowNull: false },
    slug:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'organizations', paranoid: true, underscored: true }
)

export default Organization
