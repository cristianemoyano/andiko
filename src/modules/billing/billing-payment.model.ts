import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, BillingPaymentMethod } from '@/types'
import { BILLING_PAYMENT_METHODS } from '@/types'
import BillingInvoice from './billing-invoice.model'

export interface BillingPaymentAttributes extends Timestamps, AuditFields {
  id: UUID
  invoice_id: UUID
  payment_number: string
  payment_date: Date
  amount: string
  payment_method: BillingPaymentMethod
  reference: string | null
  notes: string | null
}

type BillingPaymentCreationAttributes = Optional<
  BillingPaymentAttributes,
  | 'id' | 'payment_date' | 'reference' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingPayment extends AuditModel<BillingPaymentAttributes, BillingPaymentCreationAttributes> {
  declare id: UUID
  declare invoice_id: UUID
  declare payment_number: string
  declare payment_date: Date
  declare amount: string
  declare payment_method: BillingPaymentMethod
  declare reference: string | null
  declare notes: string | null
}

BillingPayment.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_id:     { type: DataTypes.UUID, allowNull: false },
    payment_number: { type: DataTypes.STRING(30), allowNull: false },
    payment_date:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    payment_method: { type: DataTypes.ENUM(...BILLING_PAYMENT_METHODS), allowNull: false },
    reference:      { type: DataTypes.STRING(255) },
    notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_payments', paranoid: true, underscored: true }
)

BillingPayment.belongsTo(BillingInvoice, { foreignKey: 'invoice_id', as: 'invoice' })
BillingInvoice.hasMany(BillingPayment, { foreignKey: 'invoice_id', as: 'payments' })

export default BillingPayment
