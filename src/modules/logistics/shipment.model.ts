import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { SHIPMENT_STATUSES, FULFILLMENT_KINDS, type ShipmentStatus, type FulfillmentKind } from './logistics.constants'
import CarrierAccount from './carrier-account.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import User from '@/modules/auth/user.model'

export interface ShipmentAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID
  sales_order_id: UUID
  carrier_account_id: UUID | null
  warehouse_id: UUID | null
  shipment_number: string
  status: ShipmentStatus
  provider_kind: FulfillmentKind
  tracking_number: string | null
  tracking_url: string | null
  label_url: string | null
  assigned_driver_id: UUID | null
  vehicle_ref: string | null
  shipping_cost: string
  currency: string
  ship_to_name: string | null
  ship_to_phone: string | null
  ship_street: string | null
  ship_number: string | null
  ship_floor: string | null
  ship_apartment: string | null
  ship_city: string | null
  ship_province: string | null
  ship_postal_code: string | null
  ship_country: string
  promised_date: Date | string | null
  dispatched_at: Date | null
  delivered_at: Date | null
  delivery_notes: string | null
  failure_reason: string | null
}

type ShipmentCreationAttributes = Optional<
  ShipmentAttributes,
  | 'id' | 'org_id' | 'carrier_account_id' | 'warehouse_id'
  | 'status' | 'tracking_number' | 'tracking_url' | 'label_url'
  | 'assigned_driver_id' | 'vehicle_ref' | 'shipping_cost' | 'currency'
  | 'ship_to_name' | 'ship_to_phone' | 'ship_street' | 'ship_number' | 'ship_floor' | 'ship_apartment'
  | 'ship_city' | 'ship_province' | 'ship_postal_code' | 'ship_country'
  | 'promised_date' | 'dispatched_at' | 'delivered_at' | 'delivery_notes' | 'failure_reason'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Shipment extends AuditModel<ShipmentAttributes, ShipmentCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare sales_order_id: UUID
  declare carrier_account_id: UUID | null
  declare warehouse_id: UUID | null
  declare shipment_number: string
  declare status: ShipmentStatus
  declare provider_kind: FulfillmentKind
  declare tracking_number: string | null
  declare tracking_url: string | null
  declare label_url: string | null
  declare assigned_driver_id: UUID | null
  declare vehicle_ref: string | null
  declare shipping_cost: string
  declare currency: string
  declare ship_to_name: string | null
  declare ship_to_phone: string | null
  declare ship_street: string | null
  declare ship_number: string | null
  declare ship_floor: string | null
  declare ship_apartment: string | null
  declare ship_city: string | null
  declare ship_province: string | null
  declare ship_postal_code: string | null
  declare ship_country: string
  declare promised_date: Date | string | null
  declare dispatched_at: Date | null
  declare delivered_at: Date | null
  declare delivery_notes: string | null
  declare failure_reason: string | null
}

Shipment.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:          { type: DataTypes.UUID, allowNull: false },
    sales_order_id:     { type: DataTypes.UUID, allowNull: false },
    carrier_account_id: { type: DataTypes.UUID },
    warehouse_id:       { type: DataTypes.UUID },
    shipment_number:    { type: DataTypes.STRING(20), allowNull: false },
    status:             { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [[...SHIPMENT_STATUSES]] } },
    provider_kind:      { type: DataTypes.STRING(40), allowNull: false, validate: { isIn: [[...FULFILLMENT_KINDS]] } },
    tracking_number:    { type: DataTypes.STRING(120) },
    tracking_url:       { type: DataTypes.TEXT },
    label_url:          { type: DataTypes.TEXT },
    assigned_driver_id: { type: DataTypes.UUID },
    vehicle_ref:        { type: DataTypes.STRING(60) },
    shipping_cost:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    currency:           { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    ship_to_name:       { type: DataTypes.STRING(160) },
    ship_to_phone:      { type: DataTypes.STRING(40) },
    ship_street:        { type: DataTypes.STRING(255) },
    ship_number:        { type: DataTypes.STRING(20) },
    ship_floor:         { type: DataTypes.STRING(20) },
    ship_apartment:     { type: DataTypes.STRING(20) },
    ship_city:          { type: DataTypes.STRING(100) },
    ship_province:      { type: DataTypes.STRING(100) },
    ship_postal_code:   { type: DataTypes.STRING(10) },
    ship_country:       { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Argentina' },
    promised_date:      { type: DataTypes.DATEONLY },
    dispatched_at:      { type: DataTypes.DATE },
    delivered_at:       { type: DataTypes.DATE },
    delivery_notes:     { type: DataTypes.TEXT },
    failure_reason:     { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'shipments', paranoid: true, underscored: true }
)

// Turbopack/HMR re-evaluates modules; guard against duplicate alias registration.
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'salesOrder')) {
  Shipment.belongsTo(SalesOrder, { foreignKey: 'sales_order_id', as: 'salesOrder' })
}
if (!Object.prototype.hasOwnProperty.call(SalesOrder.associations, 'shipments')) {
  SalesOrder.hasMany(Shipment, { foreignKey: 'sales_order_id', as: 'shipments' })
}
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'carrierAccount')) {
  Shipment.belongsTo(CarrierAccount, { foreignKey: 'carrier_account_id', as: 'carrierAccount' })
}
if (!Object.prototype.hasOwnProperty.call(CarrierAccount.associations, 'shipments')) {
  CarrierAccount.hasMany(Shipment, { foreignKey: 'carrier_account_id', as: 'shipments' })
}
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'driver')) {
  Shipment.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' })
}

export default Shipment
