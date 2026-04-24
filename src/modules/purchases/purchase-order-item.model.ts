import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'
import PurchaseOrder from './purchase-order.model'

export interface PurchaseOrderItemAttributes extends Timestamps, AuditFields {
  id: UUID
  order_id: UUID
  product_id: UUID | null
  variant_id: UUID | null
  description: string
  quantity: string
  received_qty: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

type PurchaseOrderItemCreationAttributes = Optional<
  PurchaseOrderItemAttributes,
  | 'id' | 'product_id' | 'variant_id' | 'received_qty' | 'discount_pct' | 'iva_rate'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseOrderItem extends AuditModel<PurchaseOrderItemAttributes, PurchaseOrderItemCreationAttributes> {
  declare id: UUID
  declare order_id: UUID
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare description: string
  declare quantity: string
  declare received_qty: string
  declare unit_price: string
  declare discount_pct: string
  declare iva_rate: IvaRate
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare sort_order: number
}

PurchaseOrderItem.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id:        { type: DataTypes.UUID, allowNull: false },
    product_id:      { type: DataTypes.UUID },
    variant_id:      { type: DataTypes.UUID },
    description:     { type: DataTypes.STRING(500), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    received_qty:    { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_pct:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0' },
    iva_rate:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_order_items', paranoid: true, underscored: true },
)

PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'order_id', as: 'items' })
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'order_id', as: 'order' })

export default PurchaseOrderItem
