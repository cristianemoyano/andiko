import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const DELIVERY_NOTE_STATUSES = ['draft', 'issued', 'delivered', 'annulled'] as const
export type DeliveryNoteStatus = typeof DELIVERY_NOTE_STATUSES[number]

export interface DeliveryNoteAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  order_id: UUID | null
  contact_id: UUID | null
  warehouse_id: UUID | null
  shipment_id: UUID | null
  issued_by: UUID | null
  delivery_number: string
  status: DeliveryNoteStatus
  deducts_stock: boolean
  delivery_date: Date | null
  carrier_account_id: UUID | null
  carrier: string | null
  tracking_code: string | null
  ship_to_address: string | null
  notes: string | null
  internal_notes: string | null
}

type DeliveryNoteCreationAttributes = Optional<
  DeliveryNoteAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'order_id' | 'contact_id' | 'warehouse_id' | 'shipment_id' | 'issued_by'
  | 'status' | 'deducts_stock' | 'delivery_date' | 'carrier_account_id' | 'carrier' | 'tracking_code'
  | 'ship_to_address' | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class DeliveryNote extends AuditModel<DeliveryNoteAttributes, DeliveryNoteCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare order_id: UUID | null
  declare contact_id: UUID | null
  declare warehouse_id: UUID | null
  declare shipment_id: UUID | null
  declare issued_by: UUID | null
  declare delivery_number: string
  declare status: DeliveryNoteStatus
  declare deducts_stock: boolean
  declare delivery_date: Date | null
  declare carrier_account_id: UUID | null
  declare carrier: string | null
  declare tracking_code: string | null
  declare ship_to_address: string | null
  declare notes: string | null
  declare internal_notes: string | null
}

DeliveryNote.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:       { type: DataTypes.UUID },
    order_id:        { type: DataTypes.UUID },
    contact_id:      { type: DataTypes.UUID },
    warehouse_id:    { type: DataTypes.UUID },
    shipment_id:     { type: DataTypes.UUID },
    issued_by:       { type: DataTypes.UUID },
    delivery_number: { type: DataTypes.STRING(20), allowNull: false },
    status:          { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    deducts_stock:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    delivery_date:       { type: DataTypes.DATE },
    carrier_account_id:  { type: DataTypes.UUID },
    carrier:             { type: DataTypes.STRING(255) },
    tracking_code:   { type: DataTypes.STRING(100) },
    ship_to_address: { type: DataTypes.TEXT },
    notes:           { type: DataTypes.TEXT },
    internal_notes:  { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'delivery_notes', paranoid: true, underscored: true },
)

export default DeliveryNote
