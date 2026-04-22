import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'

export interface UserBranchAttributes extends Timestamps {
  id: UUID
  user_id: UUID
  branch_id: UUID
}

type UserBranchCreationAttributes = Optional<
  UserBranchAttributes,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>

class UserBranch extends Model<UserBranchAttributes, UserBranchCreationAttributes> {
  declare id: UUID
  declare user_id: UUID
  declare branch_id: UUID
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

UserBranch.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id:   { type: DataTypes.UUID, allowNull: false },
    branch_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'user_branches', paranoid: true, underscored: true },
)

User.hasMany(UserBranch, { foreignKey: 'user_id', as: 'userBranches' })
UserBranch.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
Branch.hasMany(UserBranch, { foreignKey: 'branch_id', as: 'userBranches' })
UserBranch.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })

export default UserBranch
