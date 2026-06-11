import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

interface CatalogImportRowAttributeAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  import_source: string
  row_external_id: string
  column_header: string
  value_text: string | null
  product_id: UUID | null
  variant_id: UUID | null
  deleted_at: Date | null
}

type CatalogImportRowAttributeCreation = Optional<
  CatalogImportRowAttributeAttributes,
  'id' | 'value_text' | 'product_id' | 'variant_id' | 'deleted_at' | 'created_at' | 'updated_at'
>

class CatalogImportRowAttribute extends Model<
  CatalogImportRowAttributeAttributes,
  CatalogImportRowAttributeCreation
> {
  declare id: UUID
  declare org_id: UUID
  declare import_source: string
  declare row_external_id: string
  declare column_header: string
  declare value_text: string | null
  declare product_id: UUID | null
  declare variant_id: UUID | null
}

CatalogImportRowAttribute.init(
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:           { type: DataTypes.UUID, allowNull: false },
    import_source:    { type: DataTypes.STRING(32), allowNull: false },
    row_external_id:  { type: DataTypes.STRING(64), allowNull: false },
    column_header:    { type: DataTypes.STRING(255), allowNull: false },
    value_text:       { type: DataTypes.TEXT },
    product_id:       { type: DataTypes.UUID },
    variant_id:       { type: DataTypes.UUID },
    created_at:       { type: DataTypes.DATE, allowNull: false },
    updated_at:       { type: DataTypes.DATE, allowNull: false },
    deleted_at:       { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'catalog_import_row_attributes', paranoid: true, underscored: true },
)

export default CatalogImportRowAttribute
