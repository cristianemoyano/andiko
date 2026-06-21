import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import Permission from './permission.model'
import OrgRole from './org-role.model'

export interface OrgRolePermissionAttributes {
  id: UUID
  org_role_id: UUID
  permission_id: UUID
  created_at: Date
}

type OrgRolePermissionCreationAttributes = Optional<
  OrgRolePermissionAttributes,
  'id' | 'created_at'
>

export class OrgRolePermission extends Model<
  OrgRolePermissionAttributes,
  OrgRolePermissionCreationAttributes
> {
  declare id: UUID
  declare org_role_id: UUID
  declare permission_id: UUID
  declare created_at: Date
}

OrgRolePermission.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_role_id:   { type: DataTypes.UUID, allowNull: false },
    permission_id: { type: DataTypes.UUID, allowNull: false },
    created_at:    { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'org_role_permissions', timestamps: false, underscored: true },
)

OrgRolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' })
OrgRolePermission.belongsTo(OrgRole, { foreignKey: 'org_role_id', as: 'org_role' })
OrgRole.hasMany(OrgRolePermission, { foreignKey: 'org_role_id', as: 'permissions' })

export default OrgRolePermission
