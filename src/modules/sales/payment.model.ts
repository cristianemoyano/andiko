import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Invoice from './invoice.model'
import User from '@/modules/auth/user.model'
import { PAYMENT_METHODS, type PaymentMethod } from './payment.constants'

export { PAYMENT_METHODS, type PaymentMethod } from './payment.constants'

export interface PaymentAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  invoice_id: UUID
  contact_id: UUID | null
  salesperson_id: UUID | null
  payment_number: string
  payment_date: Date
  amount: string
  payment_method: PaymentMethod
  reference: string | null
  notes: string | null
}

type PaymentCreationAttributes = Optional<
  PaymentAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'salesperson_id' | 'payment_date' | 'reference' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Payment extends AuditModel<PaymentAttributes, PaymentCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare invoice_id: UUID
  declare contact_id: UUID | null
  declare salesperson_id: UUID | null
  declare payment_number: string
  declare payment_date: Date
  declare amount: string
  declare payment_method: PaymentMethod
  declare reference: string | null
  declare notes: string | null
}

Payment.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:      { type: DataTypes.UUID },
    invoice_id:     { type: DataTypes.UUID, allowNull: false },
    contact_id:     { type: DataTypes.UUID },
    salesperson_id: { type: DataTypes.UUID },
    payment_number: { type: DataTypes.STRING(20), allowNull: false },
    payment_date:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    payment_method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    reference:      { type: DataTypes.STRING(255) },
    notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'payments', paranoid: true, underscored: true }
)

Payment.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' })
Invoice.hasMany(Payment, { foreignKey: 'invoice_id', as: 'payments' })

Payment.belongsTo(User, { foreignKey: 'salesperson_id', as: 'salesperson' })
User.hasMany(Payment, { foreignKey: 'salesperson_id', as: 'salesPayments' })

export default Payment
