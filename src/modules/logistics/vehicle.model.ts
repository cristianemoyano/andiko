import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export interface VehicleAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  label: string
  plate: string | null
  notes: string | null
  is_active: boolean
}

type VehicleCreationAttributes = Optional<
  VehicleAttributes,
  'id' | 'org_id' | 'branch_id' | 'plate' | 'notes' | 'is_active' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Vehicle extends AuditModel<VehicleAttributes, VehicleCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare label: string
  declare plate: string | null
  declare notes: string | null
  declare is_active: boolean
}

Vehicle.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id: { type: DataTypes.UUID },
    label:     { type: DataTypes.STRING(120), allowNull: false },
    plate:     { type: DataTypes.STRING(20) },
    notes:     { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'vehicles', paranoid: true, underscored: true },
)

export default Vehicle
