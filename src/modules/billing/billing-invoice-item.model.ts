import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, BillingLineKind, IvaRate } from '@/types'
import { BILLING_LINE_KINDS } from '@/types'
import BillingInvoice from './billing-invoice.model'

export interface BillingInvoiceItemAttributes extends Timestamps, AuditFields {
  id: UUID
  invoice_id: UUID
  kind: BillingLineKind
  description: string
  quantity: string
  unit_price: string
  iva_rate: IvaRate
  subtotal: string
  tax_base: string
  tax_amount: string
  total: string
  sort_order: number
  metadata: Record<string, unknown> | null
}

type BillingInvoiceItemCreationAttributes = Optional<
  BillingInvoiceItemAttributes,
  | 'id' | 'iva_rate' | 'sort_order' | 'metadata'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingInvoiceItem extends AuditModel<BillingInvoiceItemAttributes, BillingInvoiceItemCreationAttributes> {
  declare id: UUID
  declare invoice_id: UUID
  declare kind: BillingLineKind
  declare description: string
  declare quantity: string
  declare unit_price: string
  declare iva_rate: IvaRate
  declare subtotal: string
  declare tax_base: string
  declare tax_amount: string
  declare total: string
  declare sort_order: number
  declare metadata: Record<string, unknown> | null
}

BillingInvoiceItem.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_id:  { type: DataTypes.UUID, allowNull: false },
    kind:        { type: DataTypes.ENUM(...BILLING_LINE_KINDS), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: false },
    quantity:    { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '1.0000' },
    unit_price:  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    iva_rate:    { type: DataTypes.ENUM('0', '10.5', '21', '27'), allowNull: false, defaultValue: '21' },
    subtotal:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_base:    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    metadata:    { type: DataTypes.JSONB },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_invoice_items', paranoid: true, underscored: true }
)

BillingInvoiceItem.belongsTo(BillingInvoice, { foreignKey: 'invoice_id', as: 'invoice' })
BillingInvoice.hasMany(BillingInvoiceItem, { foreignKey: 'invoice_id', as: 'items' })

export default BillingInvoiceItem
