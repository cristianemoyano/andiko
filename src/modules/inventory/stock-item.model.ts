import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import Warehouse from './warehouse.model'

export interface StockItemAttributes {
  id: UUID
  variant_id: UUID
  warehouse_id: UUID
  org_id: UUID
  quantity: string
  created_at: Date
  updated_at: Date
}

type StockItemCreationAttributes = Optional<StockItemAttributes, 'id' | 'quantity' | 'created_at' | 'updated_at'>

class StockItem extends Model<StockItemAttributes, StockItemCreationAttributes> {
  declare id: UUID
  declare variant_id: UUID
  declare warehouse_id: UUID
  declare org_id: UUID
  declare quantity: string
  declare created_at: Date
  declare updated_at: Date
}

StockItem.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    variant_id:   { type: DataTypes.UUID, allowNull: false },
    warehouse_id: { type: DataTypes.UUID, allowNull: false },
    org_id:       { type: DataTypes.UUID, allowNull: false },
    quantity:     { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    created_at:   { type: DataTypes.DATE, allowNull: false },
    updated_at:   { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'stock_items', paranoid: false, underscored: true }
)

Warehouse.hasMany(StockItem, { foreignKey: 'warehouse_id', as: 'stockItems' })
StockItem.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' })

export default StockItem
