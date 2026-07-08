import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { DELIVERY_STOP_STATUSES, type DeliveryStopStatus } from './logistics.constants'
import DeliveryRun from './delivery-run.model'
import Contact from '@/modules/contacts/contact.model'

export interface DeliveryStopAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  delivery_run_id: UUID
  sequence: number
  contact_id: UUID | null
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
  status: DeliveryStopStatus
  delivered_at: Date | null
  failure_reason: string | null
  delivery_result_reason: string | null
  delivery_result_notes: string | null
  cod_expected_amount: string | null
}

type DeliveryStopCreationAttributes = Optional<
  DeliveryStopAttributes,
  | 'id' | 'org_id' | 'contact_id'
  | 'ship_to_name' | 'ship_to_phone' | 'ship_street' | 'ship_number' | 'ship_floor' | 'ship_apartment'
  | 'ship_city' | 'ship_province' | 'ship_postal_code' | 'ship_country'
  | 'status' | 'delivered_at' | 'failure_reason' | 'delivery_result_reason' | 'delivery_result_notes' | 'cod_expected_amount'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class DeliveryStop extends AuditModel<DeliveryStopAttributes, DeliveryStopCreationAttributes> {
  declare id: UUID
  declare delivery_run_id: UUID
  declare sequence: number
  declare contact_id: UUID | null
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
  declare status: DeliveryStopStatus
  declare delivered_at: Date | null
  declare failure_reason: string | null
  declare delivery_result_reason: string | null
  declare delivery_result_notes: string | null
  declare cod_expected_amount: string | null
}

DeliveryStop.init(
  {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    delivery_run_id:     { type: DataTypes.UUID, allowNull: false },
    sequence:            { type: DataTypes.INTEGER, allowNull: false },
    contact_id:          { type: DataTypes.UUID },
    ship_to_name:        { type: DataTypes.STRING(160) },
    ship_to_phone:       { type: DataTypes.STRING(40) },
    ship_street:         { type: DataTypes.STRING(255) },
    ship_number:         { type: DataTypes.STRING(20) },
    ship_floor:          { type: DataTypes.STRING(20) },
    ship_apartment:      { type: DataTypes.STRING(20) },
    ship_city:           { type: DataTypes.STRING(100) },
    ship_province:       { type: DataTypes.STRING(100) },
    ship_postal_code:    { type: DataTypes.STRING(10) },
    ship_country:        { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Argentina' },
    status:              { type: DataTypes.ENUM(...DELIVERY_STOP_STATUSES), allowNull: false, defaultValue: 'pending' },
    delivered_at:        { type: DataTypes.DATE },
    failure_reason:      { type: DataTypes.TEXT },
    delivery_result_reason: { type: DataTypes.STRING(60) },
    delivery_result_notes:  { type: DataTypes.TEXT },
    cod_expected_amount: { type: DataTypes.DECIMAL(15, 2) },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'delivery_stops', paranoid: true, underscored: true },
)

if (!Object.prototype.hasOwnProperty.call(DeliveryStop.associations, 'deliveryRun')) {
  DeliveryStop.belongsTo(DeliveryRun, { foreignKey: 'delivery_run_id', as: 'deliveryRun' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRun.associations, 'stops')) {
  DeliveryRun.hasMany(DeliveryStop, { foreignKey: 'delivery_run_id', as: 'stops' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryStop.associations, 'contact')) {
  DeliveryStop.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
}

export default DeliveryStop
