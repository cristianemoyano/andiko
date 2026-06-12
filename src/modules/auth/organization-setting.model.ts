import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'
import type { OrgModuleKey } from './organization-modules'

export interface OrganizationSettingAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  enabled_modules: OrgModuleKey[] | null
  enabled_features: Record<string, boolean> | null
  print_template: Record<string, unknown> | null
  email_settings: Record<string, unknown> | null
  email_templates: Record<string, unknown> | null
}

type OrganizationSettingCreationAttributes = Optional<
  OrganizationSettingAttributes,
  | 'id' | 'enabled_modules' | 'enabled_features' | 'print_template'
  | 'email_settings' | 'email_templates'
  | 'created_at' | 'updated_at' | 'deleted_at'
>

export class OrganizationSetting extends Model<
  OrganizationSettingAttributes,
  OrganizationSettingCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare enabled_modules: OrgModuleKey[] | null
  declare enabled_features: Record<string, boolean> | null
  declare print_template: Record<string, unknown> | null
  declare email_settings: Record<string, unknown> | null
  declare email_templates: Record<string, unknown> | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

OrganizationSetting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: { type: DataTypes.UUID, allowNull: false },
    enabled_modules: { type: DataTypes.JSONB, allowNull: true },
    enabled_features: { type: DataTypes.JSONB, allowNull: true },
    print_template: { type: DataTypes.JSONB, allowNull: true },
    email_settings: { type: DataTypes.JSONB, allowNull: true },
    email_templates: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'organization_settings', paranoid: true, underscored: true },
)

export default OrganizationSetting
