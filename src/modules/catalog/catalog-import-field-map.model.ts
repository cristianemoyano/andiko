import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

interface CatalogImportFieldMapAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  profile: string | null
  external_header: string
  internal_field_key: string
  deleted_at: Date | null
}

type CatalogImportFieldMapCreation = Optional<
  CatalogImportFieldMapAttributes,
  'id' | 'profile' | 'deleted_at' | 'created_at' | 'updated_at'
>

class CatalogImportFieldMap extends Model<CatalogImportFieldMapAttributes, CatalogImportFieldMapCreation> {
  declare id: UUID
  declare org_id: UUID
  declare profile: string | null
  declare external_header: string
  declare internal_field_key: string
}

CatalogImportFieldMap.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:            { type: DataTypes.UUID, allowNull: false },
    profile:           { type: DataTypes.STRING(64) },
    external_header:   { type: DataTypes.STRING(255), allowNull: false },
    internal_field_key:{ type: DataTypes.STRING(64), allowNull: false },
    created_at:        { type: DataTypes.DATE, allowNull: false },
    updated_at:        { type: DataTypes.DATE, allowNull: false },
    deleted_at:        { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'catalog_import_field_maps', paranoid: true, underscored: true },
)

export default CatalogImportFieldMap
