import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'
import SalesOrder from './sales-order.model'

export interface SalesOrderItemAttributes extends Timestamps, AuditFields {
  id: UUID
  order_id: UUID
  product_id: UUID | null
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
  sort_order: number
}

type SalesOrderItemCreationAttributes = Optional<
  SalesOrderItemAttributes,
  | 'id' | 'product_id' | 'discount_pct' | 'iva_rate' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SalesOrderItem extends AuditModel<SalesOrderItemAttributes, SalesOrderItemCreationAttributes> {
  declare id: UUID
  declare order_id: UUID
  declare product_id: UUID | null
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
  declare sort_order: number
}

SalesOrderItem.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id:        { type: DataTypes.UUID, allowNull: false },
    product_id:      { type: DataTypes.UUID },
    description:     { type: DataTypes.STRING(500), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_pct:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0.00' },
    iva_rate:        { type: DataTypes.ENUM('0', '10.5', '21', '27'), allowNull: false, defaultValue: '21' },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_base:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    tax_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    total:           { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'sales_order_items', paranoid: true, underscored: true }
)

SalesOrder.hasMany(SalesOrderItem, { foreignKey: 'order_id', as: 'items' })
SalesOrderItem.belongsTo(SalesOrder, { foreignKey: 'order_id', as: 'order' })

export default SalesOrderItem
