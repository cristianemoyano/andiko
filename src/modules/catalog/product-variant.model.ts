import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Product from './product.model'

interface ProductVariantAttributes extends Timestamps, AuditFields {
  id: UUID
  product_id: UUID
  sku: string
  barcode: string | null
  name: string | null
  is_default: boolean
  cost_price: string | null
  base_price: string | null
  manage_stock: boolean
  stock_quantity: number
}

type ProductVariantCreationAttributes = Optional<
  ProductVariantAttributes,
  'id' | 'barcode' | 'name' | 'is_default' | 'cost_price' | 'base_price' | 'manage_stock' | 'stock_quantity' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class ProductVariant extends AuditModel<ProductVariantAttributes, ProductVariantCreationAttributes> {
  declare id: UUID
  declare product_id: UUID
  declare sku: string
  declare barcode: string | null
  declare name: string | null
  declare is_default: boolean
  declare cost_price: string | null  // NUMERIC stored as string by Sequelize
  declare base_price: string | null
  declare manage_stock: boolean
  declare stock_quantity: number
}

ProductVariant.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    product_id:     { type: DataTypes.UUID, allowNull: false },
    sku:            { type: DataTypes.STRING(100), allowNull: false },
    barcode:        { type: DataTypes.STRING(100) },
    name:           { type: DataTypes.STRING(255) },
    is_default:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    cost_price:     { type: DataTypes.DECIMAL(15, 2) },
    base_price:     { type: DataTypes.DECIMAL(15, 2) },
    manage_stock:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    stock_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'product_variants', paranoid: true, underscored: true }
)

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants' })
ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

export default ProductVariant
