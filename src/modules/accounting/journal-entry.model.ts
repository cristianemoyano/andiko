import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const JOURNAL_ENTRY_STATUSES = ['draft', 'posted'] as const
export type JournalEntryStatus = typeof JOURNAL_ENTRY_STATUSES[number]

export interface JournalEntryAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  entry_number: string
  entry_date: Date
  description: string | null
  status: JournalEntryStatus
  source_type: string | null
  source_id: UUID | null
  total_debit: string
  total_credit: string
}

type JournalEntryCreationAttributes = Optional<
  JournalEntryAttributes,
  | 'id' | 'org_id' | 'description' | 'status' | 'source_type' | 'source_id'
  | 'total_debit' | 'total_credit'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class JournalEntry extends AuditModel<JournalEntryAttributes, JournalEntryCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare entry_number: string
  declare entry_date: Date
  declare description: string | null
  declare status: JournalEntryStatus
  declare source_type: string | null
  declare source_id: UUID | null
  declare total_debit: string
  declare total_credit: string
}

JournalEntry.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    entry_number: { type: DataTypes.STRING(20), allowNull: false },
    entry_date:   { type: DataTypes.DATEONLY, allowNull: false },
    description:  { type: DataTypes.TEXT },
    status:       { type: DataTypes.ENUM(...JOURNAL_ENTRY_STATUSES), allowNull: false, defaultValue: 'draft' },
    source_type:  { type: DataTypes.STRING(30) },
    source_id:    { type: DataTypes.UUID },
    total_debit:  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total_credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'journal_entries', paranoid: true, underscored: true }
)

export default JournalEntry
