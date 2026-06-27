import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const SALES_RETURN_STATUSES = ['draft', 'confirmed', 'completed', 'cancelled'] as const
export type SalesReturnStatus = typeof SALES_RETURN_STATUSES[number]

export const SALES_RETURN_OPERATION_TYPES = ['return', 'exchange'] as const
export type SalesReturnOperationType = typeof SALES_RETURN_OPERATION_TYPES[number]

export const REFUND_DISPOSITIONS = ['account_credit', 'cash_refund'] as const
export type RefundDisposition = typeof REFUND_DISPOSITIONS[number]

export interface SalesReturnAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  order_id: UUID
  invoice_id: UUID | null
  credit_note_id: UUID | null
  exchange_invoice_id: UUID | null
  warehouse_id: UUID | null
  return_number: string
  operation_type: SalesReturnOperationType
  status: SalesReturnStatus
  source: 'erp' | 'pos'
  pos_local_id: string | null
  refund_disposition: RefundDisposition | null
  returned_subtotal: string
  returned_discount: string
  returned_tax: string
  returned_total: string
  exchange_subtotal: string
  exchange_discount: string
  exchange_tax: string
  exchange_total: string
  difference_total: string
  reason: string | null
  notes: string | null
  completed_at: Date | null
}

type SalesReturnCreationAttributes = Optional<
  SalesReturnAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'invoice_id' | 'credit_note_id' | 'exchange_invoice_id' | 'warehouse_id'
  | 'operation_type' | 'status' | 'source' | 'pos_local_id' | 'refund_disposition'
  | 'returned_subtotal' | 'returned_discount' | 'returned_tax' | 'returned_total'
  | 'exchange_subtotal' | 'exchange_discount' | 'exchange_tax' | 'exchange_total' | 'difference_total'
  | 'reason' | 'notes' | 'completed_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SalesReturn extends AuditModel<SalesReturnAttributes, SalesReturnCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare order_id: UUID
  declare invoice_id: UUID | null
  declare credit_note_id: UUID | null
  declare exchange_invoice_id: UUID | null
  declare warehouse_id: UUID | null
  declare return_number: string
  declare operation_type: SalesReturnOperationType
  declare status: SalesReturnStatus
  declare source: 'erp' | 'pos'
  declare pos_local_id: string | null
  declare refund_disposition: RefundDisposition | null
  declare returned_subtotal: string
  declare returned_discount: string
  declare returned_tax: string
  declare returned_total: string
  declare exchange_subtotal: string
  declare exchange_discount: string
  declare exchange_tax: string
  declare exchange_total: string
  declare difference_total: string
  declare reason: string | null
  declare notes: string | null
  declare completed_at: Date | null
}

SalesReturn.init(
  {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:           { type: DataTypes.UUID },
    order_id:            { type: DataTypes.UUID, allowNull: false },
    invoice_id:          { type: DataTypes.UUID },
    credit_note_id:      { type: DataTypes.UUID },
    exchange_invoice_id: { type: DataTypes.UUID },
    warehouse_id:        { type: DataTypes.UUID },
    return_number:       { type: DataTypes.STRING(20), allowNull: false },
    operation_type:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'return' },
    status:              { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    source:              { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'erp' },
    pos_local_id:        { type: DataTypes.STRING(128) },
    refund_disposition:  { type: DataTypes.STRING(20) },
    returned_subtotal:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_discount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_tax:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_total:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_subtotal:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_discount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_tax:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_total:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    difference_total:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    reason:              { type: DataTypes.TEXT },
    notes:               { type: DataTypes.TEXT },
    completed_at:        { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'sales_returns', paranoid: true, underscored: true },
)

export default SalesReturn
