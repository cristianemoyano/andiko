import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import BillOfMaterials from './bom.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface BomItemAttributes extends Timestamps, AuditFields {
  id: UUID
  bom_id: UUID
  component_variant_id: UUID
  quantity: string
  scrap_pct: string
  sort_order: number
  notes: string | null
}

type BomItemCreationAttributes = Optional<
  BomItemAttributes,
  | 'id' | 'scrap_pct' | 'sort_order' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BomItem extends AuditModel<BomItemAttributes, BomItemCreationAttributes> {
  declare id: UUID
  declare bom_id: UUID
  declare component_variant_id: UUID
  declare quantity: string
  declare scrap_pct: string
  declare sort_order: number
  declare notes: string | null
}

BomItem.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    bom_id:                { type: DataTypes.UUID, allowNull: false },
    component_variant_id:  { type: DataTypes.UUID, allowNull: false },
    quantity:              { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    scrap_pct:             { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0' },
    sort_order:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes:                 { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'bom_items', paranoid: true, underscored: true },
)

const BomItemModel         = registeredModel('BomItem', BomItem)
const BillOfMaterialsModel = registeredModel('BillOfMaterials', BillOfMaterials)
const ProductVariantModel  = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(BillOfMaterialsModel, 'items', () => {
  BillOfMaterialsModel.hasMany(BomItemModel, { foreignKey: 'bom_id', as: 'items' })
})
ensureAssociation(BomItemModel, 'bom', () => {
  BomItemModel.belongsTo(BillOfMaterialsModel, { foreignKey: 'bom_id', as: 'bom' })
})
ensureAssociation(BomItemModel, 'component', () => {
  BomItemModel.belongsTo(ProductVariantModel, { foreignKey: 'component_variant_id', as: 'component' })
})

export default BomItem
