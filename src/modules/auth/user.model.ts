import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps, UserRole } from '@/types'

interface UserAttributes extends Timestamps {
  id: UUID
  email: string
  password_hash: string
  name: string
  role: UserRole
  is_active: boolean
  org_id: UUID | null
  branch_id: UUID | null
  pos_pin_hash: string | null
  preferences: Record<string, unknown>
}

type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'role' | 'is_active' | 'org_id' | 'branch_id' | 'preferences' | 'created_at' | 'updated_at' | 'deleted_at' | 'pos_pin_hash'
>

class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: UUID
  declare email: string
  declare password_hash: string
  declare name: string
  declare role: UserRole
  declare is_active: boolean
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare pos_pin_hash: string | null
  declare preferences: Record<string, unknown>
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

User.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email:         { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    name:          { type: DataTypes.STRING(255), allowNull: false },
    role:          { type: DataTypes.ENUM('sys-admin', 'admin', 'operator', 'readonly'), allowNull: false, defaultValue: 'operator' },
    is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    org_id:        { type: DataTypes.UUID },
    branch_id:     { type: DataTypes.UUID },
    pos_pin_hash:  { type: DataTypes.STRING(255) },
    preferences:   { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at:    { type: DataTypes.DATE, allowNull: false },
    updated_at:    { type: DataTypes.DATE, allowNull: false },
    deleted_at:    { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'users', paranoid: true, underscored: true }
)

export default User
