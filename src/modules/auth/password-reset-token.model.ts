import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import User from './user.model'

export interface PasswordResetTokenAttributes {
  id: UUID
  user_id: UUID
  token_hash: string
  expires_at: Date
  used_at: Date | null
  created_at: Date
}

type PasswordResetTokenCreationAttributes = Optional<
  PasswordResetTokenAttributes,
  'id' | 'used_at' | 'created_at'
>

export class PasswordResetToken extends Model<PasswordResetTokenAttributes, PasswordResetTokenCreationAttributes> {
  declare id: UUID
  declare user_id: UUID
  declare token_hash: string
  declare expires_at: Date
  declare used_at: Date | null
  declare created_at: Date
}

PasswordResetToken.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    token_hash: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'password_reset_tokens',
    paranoid: false,
    underscored: true,
    updatedAt: false,
  },
)

PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetTokens' })

export default PasswordResetToken
