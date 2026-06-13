import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { ACCOUNT_TYPES, type AccountType } from './default-chart'

export { ACCOUNT_TYPES }
export type { AccountType }

export interface AccountAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  parent_id: UUID | null
  code: string
  name: string
  type: AccountType
  is_postable: boolean
  is_active: boolean
}

type AccountCreationAttributes = Optional<
  AccountAttributes,
  | 'id' | 'org_id' | 'parent_id' | 'is_postable' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Account extends AuditModel<AccountAttributes, AccountCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare parent_id: UUID | null
  declare code: string
  declare name: string
  declare type: AccountType
  declare is_postable: boolean
  declare is_active: boolean
}

Account.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    parent_id:   { type: DataTypes.UUID },
    code:        { type: DataTypes.STRING(20), allowNull: false },
    name:        { type: DataTypes.STRING(120), allowNull: false },
    type:        { type: DataTypes.ENUM(...ACCOUNT_TYPES), allowNull: false },
    is_postable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_active:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'accounts', paranoid: true, underscored: true }
)

// Self-referential hierarchy. Guarded for Next.js dev double-evaluation.
if (!Account.associations.parent) {
  Account.belongsTo(Account, { foreignKey: 'parent_id', as: 'parent' })
}
if (!Account.associations.children) {
  Account.hasMany(Account, { foreignKey: 'parent_id', as: 'children' })
}

export default Account
