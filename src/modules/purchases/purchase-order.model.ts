import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, PaymentCondition } from '@/types'
import User from '@/modules/auth/user.model'

export const PURCHASE_ORDER_STATUSES = ['draft', 'sent', 'partially_received', 'received', 'cancelled'] as const
export type PurchaseOrderStatus = typeof PURCHASE_ORDER_STATUSES[number]

export interface PurchaseOrderAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  buyer_id: UUID | null
  order_number: string
  status: PurchaseOrderStatus
  expected_date: Date | null
  currency: string
  payment_condition: PaymentCondition
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
}

type PurchaseOrderCreationAttributes = Optional<
  PurchaseOrderAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'buyer_id' | 'status' | 'expected_date' | 'currency' | 'payment_condition'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total'
  | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseOrder extends AuditModel<PurchaseOrderAttributes, PurchaseOrderCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare buyer_id: UUID | null
  declare order_number: string
  declare status: PurchaseOrderStatus
  declare expected_date: Date | null
  declare currency: string
  declare payment_condition: PaymentCondition
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare notes: string | null
  declare internal_notes: string | null
}

PurchaseOrder.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID },
    contact_id:        { type: DataTypes.UUID },
    buyer_id:          { type: DataTypes.UUID },
    order_number:      { type: DataTypes.STRING(20), allowNull: false },
    status:            { type: DataTypes.ENUM(...PURCHASE_ORDER_STATUSES), allowNull: false, defaultValue: 'draft' },
    expected_date:     { type: DataTypes.DATE },
    currency:          { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    payment_condition: { type: DataTypes.ENUM('cash', 'net_30', 'net_60', 'net_90'), allowNull: false, defaultValue: 'cash' },
    subtotal:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:             { type: DataTypes.TEXT },
    internal_notes:    { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_orders', paranoid: true, underscored: true },
)

PurchaseOrder.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
User.hasMany(PurchaseOrder, { foreignKey: 'buyer_id', as: 'purchaseOrders' })

export default PurchaseOrder
