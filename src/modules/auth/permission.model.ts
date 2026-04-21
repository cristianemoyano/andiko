import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export interface PermissionAttributes {
  id: UUID
  name: string
  description: string | null
  created_at: Date
}

type PermissionCreationAttributes = Optional<PermissionAttributes, 'id' | 'description' | 'created_at'>

export class Permission extends Model<PermissionAttributes, PermissionCreationAttributes> {
  declare id: UUID
  declare name: string
  declare description: string | null
  declare created_at: Date
}

Permission.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:        { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(255) },
    created_at:  { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'permissions', timestamps: false, underscored: true }
)

export default Permission
