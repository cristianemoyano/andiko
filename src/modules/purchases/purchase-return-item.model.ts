import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'
import PurchaseReturn from './purchase-return.model'
import PurchaseOrderItem from './purchase-order-item.model'

export interface PurchaseReturnItemAttributes extends Timestamps, AuditFields {
  id: UUID
  return_id: UUID
  order_item_id: UUID
  product_id: UUID | null
  variant_id: UUID | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_base: string
  tax_amount: string
  total: string
  batch_code: string | null
  expiry_date: string | null
  sort_order: number
}

type PurchaseReturnItemCreationAttributes = Optional<
  PurchaseReturnItemAttributes,
  | 'id' | 'product_id' | 'variant_id' | 'discount_pct' | 'iva_rate'
  | 'discount_amount' | 'batch_code' | 'expiry_date' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class PurchaseReturnItem extends AuditModel<PurchaseReturnItemAttributes, PurchaseReturnItemCreationAttributes> {
  declare id: UUID
  declare return_id: UUID
  declare order_item_id: UUID
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare description: string
  declare quantity: string
  declare unit_price: string
  declare discount_pct: string
  declare iva_rate: IvaRate
  declare subtotal: string
  declare discount_amount: string
  declare tax_base: string
  declare tax_amount: string
  declare total: string
  declare batch_code: string | null
  declare expiry_date: string | null
  declare sort_order: number
}

PurchaseReturnItem.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    return_id:       { type: DataTypes.UUID, allowNull: false },
    order_item_id:   { type: DataTypes.UUID, allowNull: false },
    product_id:      { type: DataTypes.UUID },
    variant_id:      { type: DataTypes.UUID },
    description:     { type: DataTypes.STRING(500), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_pct:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0.00' },
    iva_rate:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_base:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    tax_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    total:           { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    batch_code:      { type: DataTypes.STRING(100) },
    expiry_date:     { type: DataTypes.DATEONLY },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'purchase_return_items', paranoid: true, underscored: true },
)

PurchaseReturn.hasMany(PurchaseReturnItem, { foreignKey: 'return_id', as: 'items' })
PurchaseReturnItem.belongsTo(PurchaseReturn, { foreignKey: 'return_id', as: 'purchaseReturn' })

PurchaseOrderItem.hasMany(PurchaseReturnItem, { foreignKey: 'order_item_id', as: 'returnItems' })
PurchaseReturnItem.belongsTo(PurchaseOrderItem, { foreignKey: 'order_item_id', as: 'orderItem' })

export default PurchaseReturnItem
