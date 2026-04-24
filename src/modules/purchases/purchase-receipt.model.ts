import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import PurchaseOrder from './purchase-order.model'

export const PURCHASE_RECEIPT_STATUSES = ['draft', 'confirmed', 'cancelled'] as const
export type PurchaseReceiptStatus = typeof PURCHASE_RECEIPT_STATUSES[number]

export interface PurchaseReceiptAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  order_id: UUID | null
  contact_id: UUID | null
  warehouse_id: UUID | null
  receipt_number: string
  status: PurchaseReceiptStatus
  receipt_date: Date | null
  notes: string | null
  internal_notes: string | null
}

type PurchaseReceiptCreationAttributes = Optional<
  PurchaseReceiptAttributes,
  | 'id' | 'branch_id' | 'order_id' | 'contact_id' | 'warehouse_id'
  | 'status' | 'receipt_date' | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseReceipt extends AuditModel<PurchaseReceiptAttributes, PurchaseReceiptCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare order_id: UUID | null
  declare contact_id: UUID | null
  declare warehouse_id: UUID | null
  declare receipt_number: string
  declare status: PurchaseReceiptStatus
  declare receipt_date: Date | null
  declare notes: string | null
  declare internal_notes: string | null
}

PurchaseReceipt.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:      { type: DataTypes.UUID },
    order_id:       { type: DataTypes.UUID },
    contact_id:     { type: DataTypes.UUID },
    warehouse_id:   { type: DataTypes.UUID },
    receipt_number: { type: DataTypes.STRING(20), allowNull: false },
    status:         { type: DataTypes.ENUM(...PURCHASE_RECEIPT_STATUSES), allowNull: false, defaultValue: 'draft' },
    receipt_date:   { type: DataTypes.DATE },
    notes:          { type: DataTypes.TEXT },
    internal_notes: { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_receipts', paranoid: true, underscored: true },
)

PurchaseOrder.hasMany(PurchaseReceipt, { foreignKey: 'order_id', as: 'receipts' })
PurchaseReceipt.belongsTo(PurchaseOrder, { foreignKey: 'order_id', as: 'order' })

export default PurchaseReceipt
