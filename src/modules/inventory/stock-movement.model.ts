import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'transfer_in' | 'transfer_out'
export type StockReferenceType = 'order' | 'invoice_cancel' | 'manual' | 'initial' | 'purchase_receipt' | 'delivery_note' | 'sales_return' | 'sales_exchange' | 'purchase_return' | 'purchase_exchange' | 'transfer'

export interface StockMovementAttributes {
  id: UUID
  variant_id: UUID
  warehouse_id: UUID
  org_id: UUID
  movement_type: StockMovementType
  reference_type: StockReferenceType
  reference_id: UUID | null
  batch_id: UUID | null
  quantity_delta: string
  quantity_before: string
  quantity_after: string
  notes: string | null
  created_at: Date
  updated_at: Date
  created_by: UUID | null
  updated_by: UUID | null
}

type StockMovementCreationAttributes = Optional<
  StockMovementAttributes,
  | 'id' | 'reference_id' | 'batch_id' | 'notes' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>

class StockMovement extends Model<StockMovementAttributes, StockMovementCreationAttributes> {
  declare id: UUID
  declare variant_id: UUID
  declare warehouse_id: UUID
  declare org_id: UUID
  declare movement_type: StockMovementType
  declare reference_type: StockReferenceType
  declare reference_id: UUID | null
  declare batch_id: UUID | null
  declare quantity_delta: string
  declare quantity_before: string
  declare quantity_after: string
  declare notes: string | null
  declare created_at: Date
  declare updated_at: Date
  declare created_by: UUID | null
  declare updated_by: UUID | null
}

StockMovement.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    variant_id:      { type: DataTypes.UUID, allowNull: false },
    warehouse_id:    { type: DataTypes.UUID, allowNull: false },
    org_id:          { type: DataTypes.UUID, allowNull: false },
    movement_type:   { type: DataTypes.ENUM('in', 'out', 'adjustment', 'transfer_in', 'transfer_out'), allowNull: false },
    reference_type:  { type: DataTypes.STRING(50), allowNull: false },
    reference_id:    { type: DataTypes.UUID },
    batch_id:        { type: DataTypes.UUID },
    quantity_delta:  { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    quantity_before: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    quantity_after:  { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    notes:           { type: DataTypes.TEXT },
    created_at:      { type: DataTypes.DATE, allowNull: false },
    updated_at:      { type: DataTypes.DATE, allowNull: false },
    created_by:      { type: DataTypes.UUID },
    updated_by:      { type: DataTypes.UUID },
  },
  { sequelize, tableName: 'stock_movements', paranoid: false, underscored: true }
)

const WarehouseModel = registeredModel('Warehouse', Warehouse)
const StockMovementModel = registeredModel('StockMovement', StockMovement)
const ProductVariantModel = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(WarehouseModel, 'movements', () => {
  WarehouseModel.hasMany(StockMovementModel, { foreignKey: 'warehouse_id', as: 'movements' })
})
ensureAssociation(StockMovementModel, 'warehouse', () => {
  StockMovementModel.belongsTo(WarehouseModel, { foreignKey: 'warehouse_id', as: 'warehouse' })
})
ensureAssociation(StockMovementModel, 'variant', () => {
  StockMovementModel.belongsTo(ProductVariantModel, { foreignKey: 'variant_id', as: 'variant' })
})
ensureAssociation(ProductVariantModel, 'stockMovements', () => {
  ProductVariantModel.hasMany(StockMovementModel, { foreignKey: 'variant_id', as: 'stockMovements' })
})

export default StockMovement
