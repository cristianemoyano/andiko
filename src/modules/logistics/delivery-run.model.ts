import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import {
  DELIVERY_RUN_STATUSES,
  FULFILLMENT_KINDS,
  type DeliveryRunStatus,
  type FulfillmentKind,
} from './logistics.constants'
import CarrierAccount from './carrier-account.model'
import User from '@/modules/auth/user.model'
import Vehicle from './vehicle.model'

export interface DeliveryRunAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID
  run_number: string
  status: DeliveryRunStatus
  planned_date: Date | string
  assigned_driver_id: UUID | null
  vehicle_id: UUID | null
  vehicle_ref: string | null
  carrier_account_id: UUID | null
  provider_kind: FulfillmentKind
  dispatched_at: Date | null
  completed_at: Date | null
  notes: string | null
}

type DeliveryRunCreationAttributes = Optional<
  DeliveryRunAttributes,
  | 'id' | 'org_id' | 'status' | 'planned_date'
  | 'assigned_driver_id' | 'vehicle_id' | 'vehicle_ref' | 'carrier_account_id'
  | 'provider_kind' | 'dispatched_at' | 'completed_at' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class DeliveryRun extends AuditModel<DeliveryRunAttributes, DeliveryRunCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare run_number: string
  declare status: DeliveryRunStatus
  declare planned_date: Date | string
  declare assigned_driver_id: UUID | null
  declare vehicle_id: UUID | null
  declare vehicle_ref: string | null
  declare carrier_account_id: UUID | null
  declare provider_kind: FulfillmentKind
  declare dispatched_at: Date | null
  declare completed_at: Date | null
  declare notes: string | null
}

DeliveryRun.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:          { type: DataTypes.UUID, allowNull: false },
    run_number:         { type: DataTypes.STRING(20), allowNull: false },
    status:             { type: DataTypes.ENUM(...DELIVERY_RUN_STATUSES), allowNull: false, defaultValue: 'draft' },
    planned_date:       { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    assigned_driver_id: { type: DataTypes.UUID },
    vehicle_id:         { type: DataTypes.UUID },
    vehicle_ref:        { type: DataTypes.STRING(60) },
    carrier_account_id: { type: DataTypes.UUID },
    provider_kind:      { type: DataTypes.ENUM(...FULFILLMENT_KINDS), allowNull: false, defaultValue: 'in_house' },
    dispatched_at:      { type: DataTypes.DATE },
    completed_at:       { type: DataTypes.DATE },
    notes:              { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'delivery_runs', paranoid: true, underscored: true },
)

if (!Object.prototype.hasOwnProperty.call(DeliveryRun.associations, 'driver')) {
  DeliveryRun.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRun.associations, 'vehicle')) {
  DeliveryRun.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' })
}
if (!Object.prototype.hasOwnProperty.call(DeliveryRun.associations, 'carrierAccount')) {
  DeliveryRun.belongsTo(CarrierAccount, { foreignKey: 'carrier_account_id', as: 'carrierAccount' })
}

export default DeliveryRun
