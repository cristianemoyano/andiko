import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { Model } from 'sequelize'
import type { UUID, Timestamps } from '@/types'

export interface PosDeviceAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  branch_id: UUID | null
  device_id: string
  name: string | null
  api_token: string
  last_seen_at: Date | null
  license_valid_until: Date | null
  is_active: boolean
  /** Punto de venta AFIP asignado a esta terminal (override sobre la sucursal) */
  punto_venta: number | null
  deleted_at: Date | null
}

type PosDeviceCreationAttributes = Optional<
  PosDeviceAttributes,
  'id' | 'name' | 'branch_id' | 'last_seen_at' | 'license_valid_until' | 'is_active' | 'punto_venta'
  | 'created_at' | 'updated_at' | 'deleted_at'
>

class PosDevice extends Model<PosDeviceAttributes, PosDeviceCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID | null
  declare device_id: string
  declare name: string | null
  declare api_token: string
  declare last_seen_at: Date | null
  declare license_valid_until: Date | null
  declare is_active: boolean
  declare punto_venta: number | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

PosDevice.init(
  {
    id:                   { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    org_id:               { type: DataTypes.UUID, allowNull: false },
    branch_id:            { type: DataTypes.UUID },
    device_id:            { type: DataTypes.STRING(128), allowNull: false },
    name:                 { type: DataTypes.STRING(128) },
    api_token:            { type: DataTypes.STRING(256), allowNull: false },
    last_seen_at:         { type: DataTypes.DATE },
    license_valid_until:  { type: DataTypes.DATE },
    is_active:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    punto_venta:          { type: DataTypes.SMALLINT },
    created_at:           { type: DataTypes.DATE, allowNull: false },
    updated_at:           { type: DataTypes.DATE, allowNull: false },
    deleted_at:           { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: 'pos_devices',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  },
)

export default PosDevice
