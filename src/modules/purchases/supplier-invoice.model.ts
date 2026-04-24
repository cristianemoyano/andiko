import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, PaymentCondition } from '@/types'
import PurchaseOrder from './purchase-order.model'
import PurchaseReceipt from './purchase-receipt.model'

export const SUPPLIER_INVOICE_STATUSES = ['draft', 'received', 'partially_paid', 'paid', 'cancelled'] as const
export type SupplierInvoiceStatus = typeof SUPPLIER_INVOICE_STATUSES[number]

export interface SupplierInvoiceAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  order_id: UUID | null
  receipt_id: UUID | null
  invoice_number: string
  supplier_invoice_number: string | null
  status: SupplierInvoiceStatus
  invoice_date: Date | null
  due_date: Date | null
  payment_condition: PaymentCondition
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  notes: string | null
  internal_notes: string | null
}

type SupplierInvoiceCreationAttributes = Optional<
  SupplierInvoiceAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'order_id' | 'receipt_id'
  | 'supplier_invoice_number' | 'status' | 'invoice_date' | 'due_date' | 'payment_condition' | 'currency'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'paid_amount' | 'balance'
  | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SupplierInvoice extends AuditModel<SupplierInvoiceAttributes, SupplierInvoiceCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare order_id: UUID | null
  declare receipt_id: UUID | null
  declare invoice_number: string
  declare supplier_invoice_number: string | null
  declare status: SupplierInvoiceStatus
  declare invoice_date: Date | null
  declare due_date: Date | null
  declare payment_condition: PaymentCondition
  declare currency: string
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare paid_amount: string
  declare balance: string
  declare notes: string | null
  declare internal_notes: string | null
}

SupplierInvoice.init(
  {
    id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:               { type: DataTypes.UUID },
    contact_id:              { type: DataTypes.UUID },
    order_id:                { type: DataTypes.UUID },
    receipt_id:              { type: DataTypes.UUID },
    invoice_number:          { type: DataTypes.STRING(20), allowNull: false },
    supplier_invoice_number: { type: DataTypes.STRING(50) },
    status:                  { type: DataTypes.ENUM(...SUPPLIER_INVOICE_STATUSES), allowNull: false, defaultValue: 'draft' },
    invoice_date:            { type: DataTypes.DATE },
    due_date:                { type: DataTypes.DATE },
    payment_condition:       { type: DataTypes.ENUM('cash', 'net_30', 'net_60', 'net_90'), allowNull: false, defaultValue: 'cash' },
    currency:                { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:                { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:              { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:                   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    paid_amount:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    balance:                 { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:                   { type: DataTypes.TEXT },
    internal_notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'supplier_invoices', paranoid: true, underscored: true },
)

PurchaseOrder.hasMany(SupplierInvoice, { foreignKey: 'order_id', as: 'supplierInvoices' })
SupplierInvoice.belongsTo(PurchaseOrder, { foreignKey: 'order_id', as: 'order' })

PurchaseReceipt.hasMany(SupplierInvoice, { foreignKey: 'receipt_id', as: 'supplierInvoices' })
SupplierInvoice.belongsTo(PurchaseReceipt, { foreignKey: 'receipt_id', as: 'receipt' })

export default SupplierInvoice
