import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate, PaymentCondition } from '@/types'
import User from '@/modules/auth/user.model'

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'] as const
export type QuoteStatus = typeof QUOTE_STATUSES[number]

export interface SalesQuoteAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  price_list_id: UUID | null
  salesperson_id: UUID | null
  quote_number: string
  status: QuoteStatus
  valid_until: Date | null
  payment_condition: PaymentCondition
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
}

type SalesQuoteCreationAttributes = Optional<
  SalesQuoteAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'price_list_id' | 'salesperson_id' | 'status' | 'valid_until' | 'payment_condition' | 'currency'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total' | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SalesQuote extends AuditModel<SalesQuoteAttributes, SalesQuoteCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare price_list_id: UUID | null
  declare salesperson_id: UUID | null
  declare quote_number: string
  declare status: QuoteStatus
  declare valid_until: Date | null
  declare payment_condition: PaymentCondition
  declare currency: string
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare notes: string | null
  declare internal_notes: string | null
}

SalesQuote.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID },
    contact_id:        { type: DataTypes.UUID },
    price_list_id:     { type: DataTypes.UUID },
    salesperson_id:    { type: DataTypes.UUID },
    quote_number:      { type: DataTypes.STRING(20), allowNull: false },
    status:            { type: DataTypes.ENUM(...QUOTE_STATUSES), allowNull: false, defaultValue: 'draft' },
    valid_until:       { type: DataTypes.DATE },
    payment_condition: { type: DataTypes.ENUM('cash', 'net_30', 'net_60', 'net_90'), allowNull: false, defaultValue: 'cash' },
    currency:          { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:             { type: DataTypes.TEXT },
    internal_notes:    { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'sales_quotes', paranoid: true, underscored: true }
)

SalesQuote.belongsTo(User, { foreignKey: 'salesperson_id', as: 'salesperson' })
User.hasMany(SalesQuote, { foreignKey: 'salesperson_id', as: 'salesQuotes' })

export default SalesQuote

export type { IvaRate }
