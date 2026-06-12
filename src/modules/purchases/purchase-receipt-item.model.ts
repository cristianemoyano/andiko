import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import PurchaseReceipt from './purchase-receipt.model'
import PurchaseOrderItem from './purchase-order-item.model'

export interface PurchaseReceiptItemAttributes extends Timestamps, AuditFields {
  id: UUID
  receipt_id: UUID
  order_item_id: UUID | null
  product_id: UUID | null
  variant_id: UUID | null
  description: string
  quantity: string
  unit_cost: string
  sort_order: number
  batch_code: string | null
  expiry_date: string | null
}

type PurchaseReceiptItemCreationAttributes = Optional<
  PurchaseReceiptItemAttributes,
  | 'id' | 'order_item_id' | 'product_id' | 'variant_id' | 'unit_cost' | 'sort_order'
  | 'batch_code' | 'expiry_date'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseReceiptItem extends AuditModel<PurchaseReceiptItemAttributes, PurchaseReceiptItemCreationAttributes> {
  declare id: UUID
  declare receipt_id: UUID
  declare order_item_id: UUID | null
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare description: string
  declare quantity: string
  declare unit_cost: string
  declare sort_order: number
  declare batch_code: string | null
  declare expiry_date: string | null
}

PurchaseReceiptItem.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    receipt_id:    { type: DataTypes.UUID, allowNull: false },
    order_item_id: { type: DataTypes.UUID },
    product_id:    { type: DataTypes.UUID },
    variant_id:    { type: DataTypes.UUID },
    description:   { type: DataTypes.STRING(500), allowNull: false },
    quantity:      { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    unit_cost:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    batch_code:    { type: DataTypes.STRING(100), allowNull: true },
    expiry_date:   { type: DataTypes.DATEONLY, allowNull: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_receipt_items', paranoid: true, underscored: true },
)

PurchaseReceipt.hasMany(PurchaseReceiptItem, { foreignKey: 'receipt_id', as: 'items' })
PurchaseReceiptItem.belongsTo(PurchaseReceipt, { foreignKey: 'receipt_id', as: 'receipt' })

PurchaseOrderItem.hasMany(PurchaseReceiptItem, { foreignKey: 'order_item_id', as: 'receiptItems' })
PurchaseReceiptItem.belongsTo(PurchaseOrderItem, { foreignKey: 'order_item_id', as: 'orderItem' })

export default PurchaseReceiptItem
