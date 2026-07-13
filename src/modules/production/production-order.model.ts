import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { PRODUCTION_ORDER_STATUSES, type ProductionOrderStatus } from './production.constants'
import BillOfMaterials from './bom.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Warehouse from '@/modules/inventory/warehouse.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface ProductionOrderAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID
  warehouse_id: UUID | null
  order_number: string
  bom_id: UUID
  variant_id: UUID
  status: ProductionOrderStatus
  planned_quantity: string
  produced_quantity: string
  scheduled_date: string | null
  released_at: Date | null
  started_at: Date | null
  completed_at: Date | null
  cancelled_at: Date | null
  notes: string | null
}

type ProductionOrderCreationAttributes = Optional<
  ProductionOrderAttributes,
  | 'id' | 'warehouse_id' | 'status' | 'produced_quantity' | 'scheduled_date'
  | 'released_at' | 'started_at' | 'completed_at' | 'cancelled_at' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class ProductionOrder extends AuditModel<ProductionOrderAttributes, ProductionOrderCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare warehouse_id: UUID | null
  declare order_number: string
  declare bom_id: UUID
  declare variant_id: UUID
  declare status: ProductionOrderStatus
  declare planned_quantity: string
  declare produced_quantity: string
  declare scheduled_date: string | null
  declare released_at: Date | null
  declare started_at: Date | null
  declare completed_at: Date | null
  declare cancelled_at: Date | null
  declare notes: string | null
}

ProductionOrder.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID, allowNull: false },
    warehouse_id:      { type: DataTypes.UUID },
    order_number:      { type: DataTypes.STRING(30), allowNull: false },
    bom_id:            { type: DataTypes.UUID, allowNull: false },
    variant_id:        { type: DataTypes.UUID, allowNull: false },
    status:            { type: DataTypes.ENUM(...PRODUCTION_ORDER_STATUSES), allowNull: false, defaultValue: 'draft' },
    planned_quantity:  { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    produced_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    scheduled_date:    { type: DataTypes.DATEONLY },
    released_at:       { type: DataTypes.DATE },
    started_at:        { type: DataTypes.DATE },
    completed_at:      { type: DataTypes.DATE },
    cancelled_at:      { type: DataTypes.DATE },
    notes:             { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'production_orders', paranoid: true, underscored: true },
)

const ProductionOrderModel = registeredModel('ProductionOrder', ProductionOrder)
const BillOfMaterialsModel = registeredModel('BillOfMaterials', BillOfMaterials)
const ProductVariantModel  = registeredModel('ProductVariant', ProductVariant)
const WarehouseModel       = registeredModel('Warehouse', Warehouse)

ensureAssociation(ProductionOrderModel, 'bom', () => {
  ProductionOrderModel.belongsTo(BillOfMaterialsModel, { foreignKey: 'bom_id', as: 'bom' })
})
ensureAssociation(ProductionOrderModel, 'variant', () => {
  ProductionOrderModel.belongsTo(ProductVariantModel, { foreignKey: 'variant_id', as: 'variant' })
})
ensureAssociation(ProductionOrderModel, 'warehouse', () => {
  ProductionOrderModel.belongsTo(WarehouseModel, { foreignKey: 'warehouse_id', as: 'warehouse' })
})

export default ProductionOrder
