import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Shipment from './shipment.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'

export interface ShipmentItemAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  shipment_id: UUID
  sales_order_item_id: UUID
  description: string
  quantity: string
}

type ShipmentItemCreationAttributes = Optional<
  ShipmentItemAttributes,
  'id' | 'org_id' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ShipmentItem extends AuditModel<ShipmentItemAttributes, ShipmentItemCreationAttributes> {
  declare id: UUID
  declare shipment_id: UUID
  declare sales_order_item_id: UUID
  declare description: string
  declare quantity: string
}

ShipmentItem.init(
  {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shipment_id:         { type: DataTypes.UUID, allowNull: false },
    sales_order_item_id: { type: DataTypes.UUID, allowNull: false },
    description:         { type: DataTypes.STRING(500), allowNull: false },
    quantity:            { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'shipment_items', paranoid: true, underscored: true }
)

if (!Object.prototype.hasOwnProperty.call(ShipmentItem.associations, 'shipment')) {
  ShipmentItem.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' })
}
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'items')) {
  Shipment.hasMany(ShipmentItem, { foreignKey: 'shipment_id', as: 'items' })
}
if (!Object.prototype.hasOwnProperty.call(ShipmentItem.associations, 'orderItem')) {
  ShipmentItem.belongsTo(SalesOrderItem, { foreignKey: 'sales_order_item_id', as: 'orderItem' })
}
if (!Object.prototype.hasOwnProperty.call(SalesOrderItem.associations, 'shipmentItems')) {
  SalesOrderItem.hasMany(ShipmentItem, { foreignKey: 'sales_order_item_id', as: 'shipmentItems' })
}

export default ShipmentItem
