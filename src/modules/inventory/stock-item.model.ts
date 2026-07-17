import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface StockItemAttributes {
  id: UUID
  variant_id: UUID
  warehouse_id: UUID
  org_id: UUID
  quantity: string
  minimum_quantity: string
  expires_on: string | null
  last_low_stock_alert_at: Date | null
  created_at: Date
  updated_at: Date
}

type StockItemCreationAttributes = Optional<
  StockItemAttributes,
  'id' | 'quantity' | 'minimum_quantity' | 'expires_on' | 'last_low_stock_alert_at' | 'created_at' | 'updated_at'
>

class StockItem extends Model<StockItemAttributes, StockItemCreationAttributes> {
  declare id: UUID
  declare variant_id: UUID
  declare warehouse_id: UUID
  declare org_id: UUID
  declare quantity: string
  declare minimum_quantity: string
  declare expires_on: string | null
  declare last_low_stock_alert_at: Date | null
  declare created_at: Date
  declare updated_at: Date
}

StockItem.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    variant_id:   { type: DataTypes.UUID, allowNull: false },
    warehouse_id: { type: DataTypes.UUID, allowNull: false },
    org_id:             { type: DataTypes.UUID, allowNull: false },
    quantity:           { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    minimum_quantity:   { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    expires_on:         { type: DataTypes.DATEONLY, allowNull: true },
    last_low_stock_alert_at: { type: DataTypes.DATE, allowNull: true },
    created_at:         { type: DataTypes.DATE, allowNull: false },
    updated_at:         { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'stock_items', paranoid: false, underscored: true }
)

const WarehouseModel = registeredModel('Warehouse', Warehouse)
const StockItemModel = registeredModel('StockItem', StockItem)
const ProductVariantModel = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(WarehouseModel, 'stockItems', () => {
  WarehouseModel.hasMany(StockItemModel, { foreignKey: 'warehouse_id', as: 'stockItems' })
})
ensureAssociation(StockItemModel, 'warehouse', () => {
  StockItemModel.belongsTo(WarehouseModel, { foreignKey: 'warehouse_id', as: 'warehouse' })
})
ensureAssociation(StockItemModel, 'variant', () => {
  StockItemModel.belongsTo(ProductVariantModel, { foreignKey: 'variant_id', as: 'variant' })
})
ensureAssociation(ProductVariantModel, 'stockItems', () => {
  ProductVariantModel.hasMany(StockItemModel, { foreignKey: 'variant_id', as: 'stockItems' })
})

export default StockItem
