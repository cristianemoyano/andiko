import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import DeliveryRun from './delivery-run.model'
import DeliveryStop from './delivery-stop.model'
import Shipment from './shipment.model'

export interface DeliveryRunShipmentAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  delivery_run_id: UUID
  delivery_stop_id: UUID
  shipment_id: UUID
}

type DeliveryRunShipmentCreationAttributes = Optional<
  DeliveryRunShipmentAttributes,
  'id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class DeliveryRunShipment extends AuditModel<DeliveryRunShipmentAttributes, DeliveryRunShipmentCreationAttributes> {
  declare id: UUID
  declare delivery_run_id: UUID
  declare delivery_stop_id: UUID
  declare shipment_id: UUID
}

DeliveryRunShipment.init(
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    delivery_run_id:  { type: DataTypes.UUID, allowNull: false },
    delivery_stop_id: { type: DataTypes.UUID, allowNull: false },
    shipment_id:      { type: DataTypes.UUID, allowNull: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'delivery_stop_shipments', paranoid: true, underscored: true },
)

if (!Object.prototype.hasOwnProperty.call(DeliveryRunShipment.associations, 'deliveryRun')) {
  DeliveryRunShipment.belongsTo(DeliveryRun, { foreignKey: 'delivery_run_id', as: 'deliveryRun' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRun.associations, 'runShipments')) {
  DeliveryRun.hasMany(DeliveryRunShipment, { foreignKey: 'delivery_run_id', as: 'runShipments' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRunShipment.associations, 'deliveryStop')) {
  DeliveryRunShipment.belongsTo(DeliveryStop, { foreignKey: 'delivery_stop_id', as: 'deliveryStop' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryStop.associations, 'runShipments')) {
  DeliveryStop.hasMany(DeliveryRunShipment, { foreignKey: 'delivery_stop_id', as: 'runShipments' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRunShipment.associations, 'shipment')) {
  DeliveryRunShipment.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' })
}
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'deliveryRunLinks')) {
  Shipment.hasMany(DeliveryRunShipment, { foreignKey: 'shipment_id', as: 'deliveryRunLinks' })
}

export default DeliveryRunShipment
