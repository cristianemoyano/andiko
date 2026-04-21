import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import ProductCategory from './product-category.model'

export type ProductType     = 'simple' | 'service'
export type ProductStatus   = 'draft' | 'active' | 'archived'
export type IvaRate         = '0' | '10.5' | '21' | '27'
export type UnitOfMeasure   = 'unidad' | 'kg' | 'g' | 'litro' | 'ml' | 'metro' | 'cm' | 'm2' | 'm3' | 'hora' | 'caja' | 'paquete' | 'docena' | 'par' | 'rollo'

export const IVA_RATES: IvaRate[]       = ['0', '10.5', '21', '27']
export const UNITS_OF_MEASURE: UnitOfMeasure[] = ['unidad', 'kg', 'g', 'litro', 'ml', 'metro', 'cm', 'm2', 'm3', 'hora', 'caja', 'paquete', 'docena', 'par', 'rollo']
export const PRODUCT_STATUSES: ProductStatus[] = ['draft', 'active', 'archived']
export const PRODUCT_TYPES: ProductType[]      = ['simple', 'service']

interface ProductAttributes extends Timestamps, AuditFields {
  id: UUID
  category_id: UUID | null
  name: string
  slug: string
  description: string | null
  short_description: string | null
  product_type: ProductType
  status: ProductStatus
  vendor: string | null
  iva_rate: IvaRate
  unit_of_measure: UnitOfMeasure
  ncm_code: string | null
  tags: string[]
  images: Array<{ url: string; alt: string | null; position: number }>
}

type ProductCreationAttributes = Optional<
  ProductAttributes,
  'id' | 'category_id' | 'description' | 'short_description' | 'product_type' | 'status' |
  'vendor' | 'iva_rate' | 'unit_of_measure' | 'ncm_code' | 'tags' | 'images' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class Product extends AuditModel<ProductAttributes, ProductCreationAttributes> {
  declare id: UUID
  declare category_id: UUID | null
  declare name: string
  declare slug: string
  declare description: string | null
  declare short_description: string | null
  declare product_type: ProductType
  declare status: ProductStatus
  declare vendor: string | null
  declare iva_rate: IvaRate
  declare unit_of_measure: UnitOfMeasure
  declare ncm_code: string | null
  declare tags: string[]
  declare images: Array<{ url: string; alt: string | null; position: number }>
}

Product.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    category_id:       { type: DataTypes.UUID },
    name:              { type: DataTypes.STRING(255), allowNull: false },
    slug:              { type: DataTypes.STRING(265), allowNull: false },
    description:       { type: DataTypes.TEXT },
    short_description: { type: DataTypes.STRING(500) },
    product_type:      { type: DataTypes.ENUM('simple', 'service'), allowNull: false, defaultValue: 'simple' },
    status:            { type: DataTypes.ENUM('draft', 'active', 'archived'), allowNull: false, defaultValue: 'draft' },
    vendor:            { type: DataTypes.STRING(255) },
    iva_rate:          { type: DataTypes.ENUM('0', '10.5', '21', '27'), allowNull: false, defaultValue: '21' },
    unit_of_measure:   { type: DataTypes.ENUM('unidad', 'kg', 'g', 'litro', 'ml', 'metro', 'cm', 'm2', 'm3', 'hora', 'caja', 'paquete', 'docena', 'par', 'rollo'), allowNull: false, defaultValue: 'unidad' },
    ncm_code:          { type: DataTypes.STRING(8) },
    tags:              { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    images:            { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'products', paranoid: true, underscored: true }
)

Product.belongsTo(ProductCategory, { foreignKey: 'category_id', as: 'category' })
ProductCategory.hasMany(Product, { foreignKey: 'category_id', as: 'products' })

export default Product
