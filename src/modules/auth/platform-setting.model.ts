import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

/**
 * Platform-wide settings (single row). Managed by sys-admin. Holds the global
 * SMTP transport + sender identity used to email documents across every org,
 * plus the platform's issuer ("emisor") fiscal details shown on the
 * subscription invoices billed to organizations.
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
  // Platform issuer ("emisor") details for invoices billed to orgs.
  biller_legal_name: string | null
  biller_cuit: string | null
  biller_iva_condition: string | null
  biller_fiscal_address: string | null
  biller_gross_income: string | null
  biller_activity_start_date: Date | string | null
  biller_email: string | null
  biller_phone: string | null
  storage_enabled: boolean
  storage_provider: 's3' | 'gdrive' | 'dropbox'
  s3_bucket: string
  s3_region: string
  s3_access_key_id: string
  /** Encrypted blob (see src/lib/crypto.ts), or '' when no secret is set. */
  s3_secret_access_key_encrypted: string
  s3_endpoint: string
  /** Encrypted base64 service-account JSON, or '' when not set. */
  gdrive_service_account_json_encrypted: string
  gdrive_folder_id: string
  dropbox_app_key: string
  /** Encrypted blob (see src/lib/crypto.ts), or '' when not set. */
  dropbox_app_secret_encrypted: string
  /** Encrypted OAuth refresh token, or '' when not set. */
  dropbox_refresh_token_encrypted: string
  /** Encrypted generated access token (dev shortcut), or '' when not set. */
  dropbox_access_token_encrypted: string
  dropbox_root_path: string
  created_at: Date
  updated_at: Date
}

type PlatformSettingCreationAttributes = Optional<
  PlatformSettingAttributes,
  | 'id' | 'singleton' | 'smtp_enabled' | 'smtp_host' | 'smtp_port' | 'smtp_secure'
  | 'smtp_user' | 'smtp_password_encrypted' | 'from_name' | 'from_address'
  | 'biller_legal_name' | 'biller_cuit' | 'biller_iva_condition' | 'biller_fiscal_address'
  | 'biller_gross_income' | 'biller_activity_start_date' | 'biller_email' | 'biller_phone'
  | 'storage_enabled' | 'storage_provider' | 's3_bucket' | 's3_region' | 's3_access_key_id'
  | 's3_secret_access_key_encrypted' | 's3_endpoint' | 'gdrive_service_account_json_encrypted'
  | 'gdrive_folder_id' | 'dropbox_app_key' | 'dropbox_app_secret_encrypted'
  | 'dropbox_refresh_token_encrypted' | 'dropbox_access_token_encrypted' | 'dropbox_root_path'
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
  declare biller_legal_name: string | null
  declare biller_cuit: string | null
  declare biller_iva_condition: string | null
  declare biller_fiscal_address: string | null
  declare biller_gross_income: string | null
  declare biller_activity_start_date: Date | string | null
  declare biller_email: string | null
  declare biller_phone: string | null
  declare storage_enabled: boolean
  declare storage_provider: 's3' | 'gdrive' | 'dropbox'
  declare s3_bucket: string
  declare s3_region: string
  declare s3_access_key_id: string
  declare s3_secret_access_key_encrypted: string
  declare s3_endpoint: string
  declare gdrive_service_account_json_encrypted: string
  declare gdrive_folder_id: string
  declare dropbox_app_key: string
  declare dropbox_app_secret_encrypted: string
  declare dropbox_refresh_token_encrypted: string
  declare dropbox_access_token_encrypted: string
  declare dropbox_root_path: string
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
    biller_legal_name: { type: DataTypes.STRING(255), allowNull: true },
    biller_cuit: { type: DataTypes.STRING(13), allowNull: true },
    biller_iva_condition: { type: DataTypes.STRING(30), allowNull: true },
    biller_fiscal_address: { type: DataTypes.STRING(500), allowNull: true },
    biller_gross_income: { type: DataTypes.STRING(32), allowNull: true },
    biller_activity_start_date: { type: DataTypes.DATEONLY, allowNull: true },
    biller_email: { type: DataTypes.STRING(320), allowNull: true },
    biller_phone: { type: DataTypes.STRING(40), allowNull: true },
    storage_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    storage_provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 's3' },
    s3_bucket: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    s3_region: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'us-east-1' },
    s3_access_key_id: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    s3_secret_access_key_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    s3_endpoint: { type: DataTypes.STRING(512), allowNull: false, defaultValue: '' },
    gdrive_service_account_json_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    gdrive_folder_id: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    dropbox_app_key: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    dropbox_app_secret_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    dropbox_refresh_token_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    dropbox_access_token_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    dropbox_root_path: { type: DataTypes.STRING(512), allowNull: false, defaultValue: '/andiko' },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'platform_settings', paranoid: false, underscored: true },
)

export default PlatformSetting
