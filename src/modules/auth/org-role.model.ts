import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export interface OrgRoleAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  name: string
  description: string | null
  allows_pos: boolean
}

type OrgRoleCreationAttributes = Optional<
  OrgRoleAttributes,
  'id' | 'description' | 'allows_pos' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class OrgRole extends Model<OrgRoleAttributes, OrgRoleCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare name: string
  declare description: string | null
  declare allows_pos: boolean
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

OrgRole.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:      { type: DataTypes.UUID, allowNull: false },
    name:        { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.STRING(255) },
    allows_pos:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at:  { type: DataTypes.DATE, allowNull: false },
    updated_at:  { type: DataTypes.DATE, allowNull: false },
    deleted_at:  { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'org_roles', paranoid: true, underscored: true },
)

export default OrgRole
