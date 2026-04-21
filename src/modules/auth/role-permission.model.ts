import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, UserRole } from '@/types'
import Permission from './permission.model'

export interface RolePermissionAttributes {
  id: UUID
  role: UserRole
  permission_id: UUID
  org_id: UUID | null
  created_at: Date
}

type RolePermissionCreationAttributes = Optional<
  RolePermissionAttributes,
  'id' | 'org_id' | 'created_at'
>

export class RolePermission extends Model<RolePermissionAttributes, RolePermissionCreationAttributes> {
  declare id: UUID
  declare role: UserRole
  declare permission_id: UUID
  declare org_id: UUID | null
  declare created_at: Date
}

RolePermission.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    role:          { type: DataTypes.ENUM('admin', 'operator', 'readonly'), allowNull: false },
    permission_id: { type: DataTypes.UUID, allowNull: false },
    org_id:        { type: DataTypes.UUID },
    created_at:    { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'role_permissions', timestamps: false, underscored: true }
)

RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' })
Permission.hasMany(RolePermission, { foreignKey: 'permission_id', as: 'role_permissions' })

export default RolePermission
