import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, BillingInvoiceStatus } from '@/types'
import { BILLING_INVOICE_STATUSES } from '@/types'
import OrgSubscription from './org-subscription.model'

export interface BillingInvoiceAttributes extends Timestamps, AuditFields {
  id: UUID
  subscription_id: UUID | null
  invoice_number: string
  status: BillingInvoiceStatus
  period_start: Date | null
  period_end: Date | null
  issue_date: Date | null
  due_date: Date | null
  currency: string
  subtotal: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  notes: string | null
}

type BillingInvoiceCreationAttributes = Optional<
  BillingInvoiceAttributes,
  | 'id' | 'subscription_id' | 'status' | 'period_start' | 'period_end' | 'issue_date' | 'due_date'
  | 'currency' | 'subtotal' | 'tax_amount' | 'total' | 'paid_amount' | 'balance' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingInvoice extends AuditModel<BillingInvoiceAttributes, BillingInvoiceCreationAttributes> {
  declare id: UUID
  declare subscription_id: UUID | null
  declare invoice_number: string
  declare status: BillingInvoiceStatus
  declare period_start: Date | null
  declare period_end: Date | null
  declare issue_date: Date | null
  declare due_date: Date | null
  declare currency: string
  declare subtotal: string
  declare tax_amount: string
  declare total: string
  declare paid_amount: string
  declare balance: string
  declare notes: string | null
}

BillingInvoice.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id: { type: DataTypes.UUID },
    invoice_number:  { type: DataTypes.STRING(30), allowNull: false },
    status:          { type: DataTypes.ENUM(...BILLING_INVOICE_STATUSES), allowNull: false, defaultValue: 'draft' },
    period_start:    { type: DataTypes.DATE },
    period_end:      { type: DataTypes.DATE },
    issue_date:      { type: DataTypes.DATE },
    due_date:        { type: DataTypes.DATE },
    currency:        { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    paid_amount:     { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    balance:         { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:           { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_invoices', paranoid: true, underscored: true }
)

BillingInvoice.belongsTo(OrgSubscription, { foreignKey: 'subscription_id', as: 'subscription' })
OrgSubscription.hasMany(BillingInvoice, { foreignKey: 'subscription_id', as: 'invoices' })

export default BillingInvoice
