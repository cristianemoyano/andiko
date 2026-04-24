import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import SupplierInvoice from './supplier-invoice.model'

export interface SupplierPaymentAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  invoice_id: UUID
  contact_id: UUID | null
  payment_number: string
  payment_date: Date
  amount: string
  payment_method: string
  notes: string | null
}

type SupplierPaymentCreationAttributes = Optional<
  SupplierPaymentAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'payment_method' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SupplierPayment extends AuditModel<SupplierPaymentAttributes, SupplierPaymentCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare invoice_id: UUID
  declare contact_id: UUID | null
  declare payment_number: string
  declare payment_date: Date
  declare amount: string
  declare payment_method: string
  declare notes: string | null
}

SupplierPayment.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:      { type: DataTypes.UUID },
    invoice_id:     { type: DataTypes.UUID, allowNull: false },
    contact_id:     { type: DataTypes.UUID },
    payment_number: { type: DataTypes.STRING(20), allowNull: false },
    payment_date:   { type: DataTypes.DATE, allowNull: false },
    amount:         { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    payment_method: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'transfer' },
    notes:          { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'supplier_payments', paranoid: true, underscored: true },
)

SupplierInvoice.hasMany(SupplierPayment, { foreignKey: 'invoice_id', as: 'payments' })
SupplierPayment.belongsTo(SupplierInvoice, { foreignKey: 'invoice_id', as: 'invoice' })

export default SupplierPayment
