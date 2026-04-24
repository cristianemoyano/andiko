import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'
import SupplierInvoice from './supplier-invoice.model'

export interface SupplierInvoiceItemAttributes extends Timestamps, AuditFields {
  id: UUID
  invoice_id: UUID
  product_id: UUID | null
  variant_id: UUID | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

type SupplierInvoiceItemCreationAttributes = Optional<
  SupplierInvoiceItemAttributes,
  | 'id' | 'product_id' | 'variant_id' | 'discount_pct' | 'iva_rate'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SupplierInvoiceItem extends AuditModel<SupplierInvoiceItemAttributes, SupplierInvoiceItemCreationAttributes> {
  declare id: UUID
  declare invoice_id: UUID
  declare product_id: UUID | null
  declare variant_id: UUID | null
  declare description: string
  declare quantity: string
  declare unit_price: string
  declare discount_pct: string
  declare iva_rate: IvaRate
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare sort_order: number
}

SupplierInvoiceItem.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_id:      { type: DataTypes.UUID, allowNull: false },
    product_id:      { type: DataTypes.UUID },
    variant_id:      { type: DataTypes.UUID },
    description:     { type: DataTypes.STRING(500), allowNull: false },
    quantity:        { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    unit_price:      { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_pct:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0' },
    iva_rate:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'supplier_invoice_items', paranoid: true, underscored: true },
)

SupplierInvoice.hasMany(SupplierInvoiceItem, { foreignKey: 'invoice_id', as: 'items' })
SupplierInvoiceItem.belongsTo(SupplierInvoice, { foreignKey: 'invoice_id', as: 'invoice' })

export default SupplierInvoiceItem
