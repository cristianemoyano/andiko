import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

export interface BillOfMaterialsAttributes extends Timestamps, AuditFields {
  id: UUID
  variant_id: UUID
  name: string
  output_quantity: string
  is_active: boolean
  notes: string | null
}

type BillOfMaterialsCreationAttributes = Optional<
  BillOfMaterialsAttributes,
  | 'id' | 'output_quantity' | 'is_active' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillOfMaterials extends AuditModel<BillOfMaterialsAttributes, BillOfMaterialsCreationAttributes> {
  declare id: UUID
  declare variant_id: UUID
  declare name: string
  declare output_quantity: string
  declare is_active: boolean
  declare notes: string | null
}

BillOfMaterials.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    variant_id:      { type: DataTypes.UUID, allowNull: false },
    name:            { type: DataTypes.STRING(255), allowNull: false },
    output_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '1' },
    is_active:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes:           { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'bills_of_materials', paranoid: true, underscored: true },
)

const BillOfMaterialsModel = registeredModel('BillOfMaterials', BillOfMaterials)
const ProductVariantModel  = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(BillOfMaterialsModel, 'variant', () => {
  BillOfMaterialsModel.belongsTo(ProductVariantModel, { foreignKey: 'variant_id', as: 'variant' })
})
ensureAssociation(ProductVariantModel, 'boms', () => {
  ProductVariantModel.hasMany(BillOfMaterialsModel, { foreignKey: 'variant_id', as: 'boms' })
})

export default BillOfMaterials
