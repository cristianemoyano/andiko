import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import { SHIPMENT_STATUSES, SHIPMENT_EVENT_SOURCES, type ShipmentStatus, type ShipmentEventSource } from './logistics.constants'
import Shipment from './shipment.model'

export interface ShipmentEventAttributes {
  id: UUID
  shipment_id: UUID
  org_id: UUID | null
  status: ShipmentStatus
  description: string | null
  occurred_at: Date
  source: ShipmentEventSource
  raw: Record<string, unknown> | null
  created_at: Date
  created_by: UUID | null
}

type ShipmentEventCreationAttributes = Optional<
  ShipmentEventAttributes,
  'id' | 'org_id' | 'description' | 'occurred_at' | 'source' | 'raw' | 'created_at' | 'created_by'
>

// Append-only timeline: events are immutable, so this model has no
// updated_at/deleted_at and must never be updated or destroyed.
class ShipmentEvent extends Model<ShipmentEventAttributes, ShipmentEventCreationAttributes> {
  declare id: UUID
  declare shipment_id: UUID
  declare org_id: UUID | null
  declare status: ShipmentStatus
  declare description: string | null
  declare occurred_at: Date
  declare source: ShipmentEventSource
  declare raw: Record<string, unknown> | null
  declare created_at: Date
  declare created_by: UUID | null
}

ShipmentEvent.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shipment_id: { type: DataTypes.UUID, allowNull: false },
    org_id:      { type: DataTypes.UUID },
    status:      { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [[...SHIPMENT_STATUSES]] } },
    description: { type: DataTypes.STRING(255) },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    source:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'system', validate: { isIn: [[...SHIPMENT_EVENT_SOURCES]] } },
    raw:         { type: DataTypes.JSONB },
    created_at:  { type: DataTypes.DATE, allowNull: false },
    created_by:  { type: DataTypes.UUID },
  },
  { sequelize, tableName: 'shipment_events', underscored: true, updatedAt: false, paranoid: false }
)

if (!Object.prototype.hasOwnProperty.call(ShipmentEvent.associations, 'shipment')) {
  ShipmentEvent.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' })
}
if (!Object.prototype.hasOwnProperty.call(Shipment.associations, 'events')) {
  Shipment.hasMany(ShipmentEvent, { foreignKey: 'shipment_id', as: 'events' })
}

export default ShipmentEvent
