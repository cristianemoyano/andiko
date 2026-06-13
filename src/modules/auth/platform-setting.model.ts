import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

/**
 * Platform-wide settings (single row). Managed by sys-admin. Holds the global
 * SMTP transport + sender identity used to email documents across every org.
 * The `singleton` column has a UNIQUE constraint so only one row can exist.
 */
export interface PlatformSettingAttributes {
  id: UUID
  singleton: boolean
  smtp_enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  /** Encrypted blob (see src/lib/crypto.ts), or '' when no password is set. */
  smtp_password_encrypted: string
  from_name: string
  from_address: string
  created_at: Date
  updated_at: Date
}

type PlatformSettingCreationAttributes = Optional<
  PlatformSettingAttributes,
  | 'id' | 'singleton' | 'smtp_enabled' | 'smtp_host' | 'smtp_port' | 'smtp_secure'
  | 'smtp_user' | 'smtp_password_encrypted' | 'from_name' | 'from_address'
  | 'created_at' | 'updated_at'
>

export class PlatformSetting extends Model<
  PlatformSettingAttributes,
  PlatformSettingCreationAttributes
> {
  declare id: UUID
  declare singleton: boolean
  declare smtp_enabled: boolean
  declare smtp_host: string
  declare smtp_port: number
  declare smtp_secure: boolean
  declare smtp_user: string
  declare smtp_password_encrypted: string
  declare from_name: string
  declare from_address: string
  declare created_at: Date
  declare updated_at: Date
}

PlatformSetting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    singleton: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, unique: true },
    smtp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    smtp_host: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    smtp_port: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 587 },
    smtp_secure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    smtp_user: { type: DataTypes.STRING(320), allowNull: false, defaultValue: '' },
    smtp_password_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    from_name: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    from_address: { type: DataTypes.STRING(320), allowNull: false, defaultValue: '' },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'platform_settings', paranoid: false, underscored: true },
)

export default PlatformSetting
