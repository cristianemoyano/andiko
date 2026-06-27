import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const PURCHASE_RETURN_STATUSES = ['draft', 'confirmed', 'completed', 'cancelled'] as const
export type PurchaseReturnStatus = typeof PURCHASE_RETURN_STATUSES[number]

export const PURCHASE_RETURN_OPERATION_TYPES = ['return', 'exchange'] as const
export type PurchaseReturnOperationType = typeof PURCHASE_RETURN_OPERATION_TYPES[number]

export interface PurchaseReturnAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  order_id: UUID
  invoice_id: UUID | null
  receipt_id: UUID | null
  warehouse_id: UUID | null
  return_number: string
  operation_type: PurchaseReturnOperationType
  status: PurchaseReturnStatus
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

type PurchaseReturnCreationAttributes = Optional<
  PurchaseReturnAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'invoice_id' | 'receipt_id' | 'warehouse_id'
  | 'operation_type' | 'status' | 'returned_subtotal' | 'returned_discount' | 'returned_tax' | 'returned_total'
  | 'exchange_subtotal' | 'exchange_discount' | 'exchange_tax' | 'exchange_total' | 'difference_total'
  | 'reason' | 'notes' | 'completed_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseReturn extends AuditModel<PurchaseReturnAttributes, PurchaseReturnCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare order_id: UUID
  declare invoice_id: UUID | null
  declare receipt_id: UUID | null
  declare warehouse_id: UUID | null
  declare return_number: string
  declare operation_type: PurchaseReturnOperationType
  declare status: PurchaseReturnStatus
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

PurchaseReturn.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID },
    order_id:          { type: DataTypes.UUID, allowNull: false },
    invoice_id:        { type: DataTypes.UUID },
    receipt_id:        { type: DataTypes.UUID },
    warehouse_id:      { type: DataTypes.UUID },
    return_number:     { type: DataTypes.STRING(20), allowNull: false },
    operation_type:    { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'return' },
    status:            { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    returned_subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_discount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_tax:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    returned_total:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_discount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_tax:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    exchange_total:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    difference_total:  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    reason:            { type: DataTypes.TEXT },
    notes:             { type: DataTypes.TEXT },
    completed_at:      { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_returns', paranoid: true, underscored: true },
)

export default PurchaseReturn
