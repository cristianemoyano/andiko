import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import SalesReturn from './sales-return.model'
import CreditNote from './credit-note.model'
import Payment from './payment.model'

export const REFUND_METHODS = [
  'cash', 'transfer', 'check', 'card', 'other', 'current_account',
] as const
export type RefundMethod = typeof REFUND_METHODS[number]

export interface SalesRefundAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  return_id: UUID
  credit_note_id: UUID | null
  payment_id: UUID | null
  refund_number: string
  amount: string
  refund_method: RefundMethod
  refund_date: Date
  reference: string | null
  notes: string | null
}

type SalesRefundCreationAttributes = Optional<
  SalesRefundAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'credit_note_id' | 'payment_id' | 'refund_date' | 'reference' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SalesRefund extends AuditModel<SalesRefundAttributes, SalesRefundCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare return_id: UUID
  declare credit_note_id: UUID | null
  declare payment_id: UUID | null
  declare refund_number: string
  declare amount: string
  declare refund_method: RefundMethod
  declare refund_date: Date
  declare reference: string | null
  declare notes: string | null
}

SalesRefund.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:      { type: DataTypes.UUID },
    return_id:      { type: DataTypes.UUID, allowNull: false },
    credit_note_id: { type: DataTypes.UUID },
    payment_id:     { type: DataTypes.UUID },
    refund_number:  { type: DataTypes.STRING(20), allowNull: false },
    amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    refund_method:  { type: DataTypes.STRING(30), allowNull: false },
    refund_date:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reference:      { type: DataTypes.STRING(255) },
    notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'sales_refunds', paranoid: true, underscored: true },
)

SalesReturn.hasMany(SalesRefund, { foreignKey: 'return_id', as: 'refunds' })
SalesRefund.belongsTo(SalesReturn, { foreignKey: 'return_id', as: 'salesReturn' })
SalesRefund.belongsTo(CreditNote, { foreignKey: 'credit_note_id', as: 'creditNote' })
SalesRefund.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' })

export default SalesRefund
