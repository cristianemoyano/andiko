import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import PriceList from './price-list.model'
import ProductVariant from './product-variant.model'
import { ensureAssociation, registeredModel } from '@/lib/sequelize-models'

interface PriceListItemAttributes extends Timestamps, AuditFields {
  id: UUID
  price_list_id: UUID
  product_variant_id: UUID
  price: string
  valid_from: Date
}

type PriceListItemCreationAttributes = Optional<
  PriceListItemAttributes,
  'id' | 'valid_from' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class PriceListItem extends AuditModel<PriceListItemAttributes, PriceListItemCreationAttributes> {
  declare id: UUID
  declare price_list_id: UUID
  declare product_variant_id: UUID
  declare price: string
  declare valid_from: Date
}

PriceListItem.init(
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    price_list_id:      { type: DataTypes.UUID, allowNull: false },
    product_variant_id: { type: DataTypes.UUID, allowNull: false },
    price:              { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    valid_from:         { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'price_list_items', paranoid: true, underscored: true }
)

const PriceListModel = registeredModel('PriceList', PriceList)
const PriceListItemModel = registeredModel('PriceListItem', PriceListItem)
const ProductVariantModel = registeredModel('ProductVariant', ProductVariant)

ensureAssociation(PriceListModel, 'items', () => {
  PriceListModel.hasMany(PriceListItemModel, { foreignKey: 'price_list_id', as: 'items' })
})
ensureAssociation(PriceListItemModel, 'price_list', () => {
  PriceListItemModel.belongsTo(PriceListModel, { foreignKey: 'price_list_id', as: 'price_list' })
})
ensureAssociation(ProductVariantModel, 'price_list_items', () => {
  ProductVariantModel.hasMany(PriceListItemModel, { foreignKey: 'product_variant_id', as: 'price_list_items' })
})
ensureAssociation(PriceListItemModel, 'variant', () => {
  PriceListItemModel.belongsTo(ProductVariantModel, { foreignKey: 'product_variant_id', as: 'variant' })
})

export default PriceListItem
