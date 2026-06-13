import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import JournalEntry from './journal-entry.model'
import Account from './account.model'

export interface JournalEntryLineAttributes extends Timestamps, AuditFields {
  id: UUID
  entry_id: UUID
  account_id: UUID
  branch_id: UUID | null
  description: string | null
  debit: string
  credit: string
  sort_order: number
}

type JournalEntryLineCreationAttributes = Optional<
  JournalEntryLineAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'description' | 'debit' | 'credit' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class JournalEntryLine extends AuditModel<JournalEntryLineAttributes, JournalEntryLineCreationAttributes> {
  declare id: UUID
  declare entry_id: UUID
  declare account_id: UUID
  declare branch_id: UUID | null
  declare description: string | null
  declare debit: string
  declare credit: string
  declare sort_order: number
}

JournalEntryLine.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entry_id:    { type: DataTypes.UUID, allowNull: false },
    account_id:  { type: DataTypes.UUID, allowNull: false },
    branch_id:   { type: DataTypes.UUID },
    description: { type: DataTypes.STRING(255) },
    debit:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    credit:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'journal_entry_lines', paranoid: true, underscored: true }
)

JournalEntry.hasMany(JournalEntryLine, { foreignKey: 'entry_id', as: 'lines' })
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'entry_id', as: 'entry' })

if (!JournalEntryLine.associations.account) {
  JournalEntryLine.belongsTo(Account, { foreignKey: 'account_id', as: 'account' })
}

export default JournalEntryLine
