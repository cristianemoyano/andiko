import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export type ProductCategoryStatus = 'active' | 'archived'

interface ProductCategoryAttributes extends Timestamps, AuditFields {
  id: UUID
  parent_id: UUID | null
  name: string
  slug: string
  description: string | null
  status: ProductCategoryStatus
}

type ProductCategoryCreationAttributes = Optional<
  ProductCategoryAttributes,
  'id' | 'parent_id' | 'description' | 'status' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class ProductCategory extends AuditModel<ProductCategoryAttributes, ProductCategoryCreationAttributes> {
  declare id: UUID
  declare parent_id: UUID | null
  declare name: string
  declare slug: string
  declare description: string | null
  declare status: ProductCategoryStatus
}

ProductCategory.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    parent_id:   { type: DataTypes.UUID },
    name:        { type: DataTypes.STRING(100), allowNull: false },
    slug:        { type: DataTypes.STRING(110), allowNull: false },
    description: { type: DataTypes.TEXT },
    status:      { type: DataTypes.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'product_categories', paranoid: true, underscored: true }
)

ProductCategory.belongsTo(ProductCategory, { foreignKey: 'parent_id', as: 'parent' })
ProductCategory.hasMany(ProductCategory, { foreignKey: 'parent_id', as: 'children' })

export default ProductCategory
