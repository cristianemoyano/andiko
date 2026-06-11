import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import DeliveryNote from './delivery-note.model'

export interface DeliveryNoteItemAttributes extends Timestamps, AuditFields {
  id: UUID
  delivery_note_id: UUID
  org_id: UUID | null
  order_item_id: UUID | null
  product_id: UUID | null
  variant_id: UUID | null
  description: string
  quantity: string
  sort_order: number
}

type DeliveryNoteItemCreationAttributes = Optional<
  DeliveryNoteItemAttributes,
  | 'id' | 'org_id' | 'order_item_id' | 'product_id' | 'variant_id' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class DeliveryNoteItem extends AuditModel<DeliveryNoteItemAttributes, DeliveryNoteItemCreationAttributes> {
  declare id: UUID
  declare delivery_note_id: UUID
  declare order_item_id: UUID | null
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare description: string
  declare quantity: string
  declare sort_order: number
}

DeliveryNoteItem.init(
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    delivery_note_id: { type: DataTypes.UUID, allowNull: false },
    order_item_id:    { type: DataTypes.UUID },
    product_id:       { type: DataTypes.UUID },
    variant_id:       { type: DataTypes.UUID },
    description:      { type: DataTypes.STRING(500), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'delivery_note_items', paranoid: true, underscored: true },
)

DeliveryNote.hasMany(DeliveryNoteItem, { foreignKey: 'delivery_note_id', as: 'items' })
DeliveryNoteItem.belongsTo(DeliveryNote, { foreignKey: 'delivery_note_id', as: 'deliveryNote' })

export default DeliveryNoteItem
