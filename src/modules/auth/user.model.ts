import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export type UserRole = 'admin' | 'operator' | 'readonly'

interface UserAttributes extends Timestamps {
  id: UUID
  email: string
  password_hash: string
  name: string
  role: UserRole
  is_active: boolean
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'role' | 'is_active' | 'created_at' | 'updated_at' | 'deleted_at'>

class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: UUID
  declare email: string
  declare password_hash: string
  declare name: string
  declare role: UserRole
  declare is_active: boolean
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'operator', 'readonly'), allowNull: false, defaultValue: 'operator' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'users', paranoid: true, underscored: true }
)

export default User
