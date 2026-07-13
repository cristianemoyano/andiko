import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import ProductionOrder from './production-order.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface ProductionOrderLineAttributes extends Timestamps, AuditFields {
  id: UUID
  order_id: UUID
  component_variant_id: UUID
  planned_quantity: string
  consumed_quantity: string
  sort_order: number
}

type ProductionOrderLineCreationAttributes = Optional<
  ProductionOrderLineAttributes,
  | 'id' | 'consumed_quantity' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class ProductionOrderLine extends AuditModel<ProductionOrderLineAttributes, ProductionOrderLineCreationAttributes> {
  declare id: UUID
  declare order_id: UUID
  declare component_variant_id: UUID
  declare planned_quantity: string
  declare consumed_quantity: string
  declare sort_order: number
}

ProductionOrderLine.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id:              { type: DataTypes.UUID, allowNull: false },
    component_variant_id:  { type: DataTypes.UUID, allowNull: false },
    planned_quantity:      { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    consumed_quantity:     { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    sort_order:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'production_order_lines', paranoid: true, underscored: true },
)

const ProductionOrderLineModel = registeredModel('ProductionOrderLine', ProductionOrderLine)
const ProductionOrderModel     = registeredModel('ProductionOrder', ProductionOrder)
const ProductVariantModel      = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(ProductionOrderModel, 'lines', () => {
  ProductionOrderModel.hasMany(ProductionOrderLineModel, { foreignKey: 'order_id', as: 'lines' })
})
ensureAssociation(ProductionOrderLineModel, 'order', () => {
  ProductionOrderLineModel.belongsTo(ProductionOrderModel, { foreignKey: 'order_id', as: 'order' })
})
ensureAssociation(ProductionOrderLineModel, 'component', () => {
  ProductionOrderLineModel.belongsTo(ProductVariantModel, { foreignKey: 'component_variant_id', as: 'component' })
})

export default ProductionOrderLine
