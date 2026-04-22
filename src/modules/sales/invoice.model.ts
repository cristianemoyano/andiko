import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, PaymentCondition } from '@/types'
import SalesQuote from './sales-quote.model'
import SalesOrder from './sales-order.model'

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'] as const
export type InvoiceStatus = typeof INVOICE_STATUSES[number]

export interface InvoiceAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  order_id: UUID | null
  quote_id: UUID | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: Date | null
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

type InvoiceCreationAttributes = Optional<
  InvoiceAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'order_id' | 'quote_id' | 'status' | 'issue_date' | 'due_date'
  | 'payment_condition' | 'currency' | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total'
  | 'paid_amount' | 'balance' | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Invoice extends AuditModel<InvoiceAttributes, InvoiceCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare order_id: UUID | null
  declare quote_id: UUID | null
  declare invoice_number: string
  declare status: InvoiceStatus
  declare issue_date: Date | null
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

Invoice.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID },
    contact_id:        { type: DataTypes.UUID },
    order_id:          { type: DataTypes.UUID },
    quote_id:          { type: DataTypes.UUID },
    invoice_number:    { type: DataTypes.STRING(20), allowNull: false },
    status:            { type: DataTypes.ENUM(...INVOICE_STATUSES), allowNull: false, defaultValue: 'draft' },
    issue_date:        { type: DataTypes.DATE },
    due_date:          { type: DataTypes.DATE },
    payment_condition: { type: DataTypes.ENUM('cash', 'net_30', 'net_60', 'net_90'), allowNull: false, defaultValue: 'cash' },
    currency:          { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    paid_amount:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    balance:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:             { type: DataTypes.TEXT },
    internal_notes:    { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'invoices', paranoid: true, underscored: true }
)

Invoice.belongsTo(SalesOrder, { foreignKey: 'order_id', as: 'order' })
SalesOrder.hasMany(Invoice, { foreignKey: 'order_id', as: 'invoices' })

Invoice.belongsTo(SalesQuote, { foreignKey: 'quote_id', as: 'quote' })
SalesQuote.hasMany(Invoice, { foreignKey: 'quote_id', as: 'invoices' })

export default Invoice
