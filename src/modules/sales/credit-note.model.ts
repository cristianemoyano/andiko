import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Invoice from './invoice.model'
import Contact from '@/modules/contacts/contact.model'

export const CREDIT_NOTE_STATUSES = ['draft', 'issued', 'cancelled'] as const
export type CreditNoteStatus = typeof CREDIT_NOTE_STATUSES[number]

export interface CreditNoteAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  invoice_id: UUID | null
  credit_note_number: string
  status: CreditNoteStatus
  issue_date: Date | null
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  applied_amount: string
  remaining: string
  reason: string | null
  notes: string | null
}

type CreditNoteCreationAttributes = Optional<
  CreditNoteAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'invoice_id' | 'status' | 'issue_date' | 'currency'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'applied_amount' | 'remaining'
  | 'reason' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CreditNote extends AuditModel<CreditNoteAttributes, CreditNoteCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare invoice_id: UUID | null
  declare credit_note_number: string
  declare status: CreditNoteStatus
  declare issue_date: Date | null
  declare currency: string
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare applied_amount: string
  declare remaining: string
  declare reason: string | null
  declare notes: string | null
}

CreditNote.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:          { type: DataTypes.UUID },
    contact_id:         { type: DataTypes.UUID },
    invoice_id:         { type: DataTypes.UUID },
    credit_note_number: { type: DataTypes.STRING(50), allowNull: false },
    status:             { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    issue_date:         { type: DataTypes.DATEONLY },
    currency:           { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:              { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    applied_amount:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    remaining:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    reason:             { type: DataTypes.TEXT },
    notes:              { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'credit_notes', paranoid: true, underscored: true },
)

CreditNote.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' })
Invoice.hasMany(CreditNote, { foreignKey: 'invoice_id', as: 'creditNotes' })

CreditNote.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
Contact.hasMany(CreditNote, { foreignKey: 'contact_id', as: 'creditNotes' })

export default CreditNote
