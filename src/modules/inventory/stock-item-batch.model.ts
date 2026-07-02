import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import StockItem from './stock-item.model'
import StockMovement from './stock-movement.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface StockItemBatchAttributes {
  id: UUID
  org_id: UUID
  stock_item_id: UUID
  /** `null` = legacy/default batch (catch-all for un-lotted stock). */
  batch_code: string | null
  expiry_date: string | null
  quantity: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

type StockItemBatchCreationAttributes = Optional<
  StockItemBatchAttributes,
  'id' | 'batch_code' | 'expiry_date' | 'quantity' | 'created_at' | 'updated_at' | 'deleted_at'
>

class StockItemBatch extends Model<StockItemBatchAttributes, StockItemBatchCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare stock_item_id: UUID
  declare batch_code: string | null
  declare expiry_date: string | null
  declare quantity: string
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

StockItemBatch.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:        { type: DataTypes.UUID, allowNull: false },
    stock_item_id: { type: DataTypes.UUID, allowNull: false },
    batch_code:    { type: DataTypes.STRING(100), allowNull: true },
    expiry_date:   { type: DataTypes.DATEONLY, allowNull: true },
    quantity:      { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    created_at:    { type: DataTypes.DATE, allowNull: false },
    updated_at:    { type: DataTypes.DATE, allowNull: false },
    deleted_at:    { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'stock_item_batches', paranoid: true, underscored: true },
)

const StockItemModel = registeredModel('StockItem', StockItem)
const StockItemBatchModel = registeredModel('StockItemBatch', StockItemBatch)
const StockMovementModel = registeredModel('StockMovement', StockMovement)

ensureAssociation(StockItemModel, 'batches', () => {
  StockItemModel.hasMany(StockItemBatchModel, { foreignKey: 'stock_item_id', as: 'batches' })
})
ensureAssociation(StockItemBatchModel, 'stockItem', () => {
  StockItemBatchModel.belongsTo(StockItemModel, { foreignKey: 'stock_item_id', as: 'stockItem' })
})
ensureAssociation(StockItemBatchModel, 'movements', () => {
  StockItemBatchModel.hasMany(StockMovementModel, { foreignKey: 'batch_id', as: 'movements' })
})
ensureAssociation(StockMovementModel, 'batch', () => {
  StockMovementModel.belongsTo(StockItemBatchModel, { foreignKey: 'batch_id', as: 'batch' })
})

export default StockItemBatch
