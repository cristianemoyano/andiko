import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, PaymentCondition } from '@/types'
import SalesQuote from './sales-quote.model'

export const ORDER_STATUSES = ['draft', 'confirmed', 'in_progress', 'delivered', 'cancelled'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export interface SalesOrderAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID | null
  contact_id: UUID | null
  quote_id: UUID | null
  price_list_id: UUID | null
  order_number: string
  status: OrderStatus
  payment_condition: PaymentCondition
  currency: string
  promised_date: Date | null
  delivered_date: Date | null
  shipping_street: string | null
  shipping_number: string | null
  shipping_floor: string | null
  shipping_apartment: string | null
  shipping_city: string | null
  shipping_province: string | null
  shipping_postal_code: string | null
  shipping_country: string | null
  billing_street: string | null
  billing_number: string | null
  billing_floor: string | null
  billing_apartment: string | null
  billing_city: string | null
  billing_province: string | null
  billing_postal_code: string | null
  billing_country: string | null
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
}

type SalesOrderCreationAttributes = Optional<
  SalesOrderAttributes,
  | 'id' | 'branch_id' | 'contact_id' | 'quote_id' | 'price_list_id' | 'status' | 'payment_condition' | 'currency'
  | 'promised_date' | 'delivered_date'
  | 'shipping_street' | 'shipping_number' | 'shipping_floor' | 'shipping_apartment' | 'shipping_city' | 'shipping_province' | 'shipping_postal_code' | 'shipping_country'
  | 'billing_street' | 'billing_number' | 'billing_floor' | 'billing_apartment' | 'billing_city' | 'billing_province' | 'billing_postal_code' | 'billing_country'
  | 'subtotal' | 'discount_amount' | 'tax_amount' | 'total'
  | 'notes' | 'internal_notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class SalesOrder extends AuditModel<SalesOrderAttributes, SalesOrderCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare contact_id: UUID | null
  declare quote_id: UUID | null
  declare price_list_id: UUID | null
  declare order_number: string
  declare status: OrderStatus
  declare payment_condition: PaymentCondition
  declare currency: string
  declare promised_date: Date | null
  declare delivered_date: Date | null
  declare shipping_street: string | null
  declare shipping_number: string | null
  declare shipping_floor: string | null
  declare shipping_apartment: string | null
  declare shipping_city: string | null
  declare shipping_province: string | null
  declare shipping_postal_code: string | null
  declare shipping_country: string | null
  declare billing_street: string | null
  declare billing_number: string | null
  declare billing_floor: string | null
  declare billing_apartment: string | null
  declare billing_city: string | null
  declare billing_province: string | null
  declare billing_postal_code: string | null
  declare billing_country: string | null
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare notes: string | null
  declare internal_notes: string | null
}

SalesOrder.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID },
    contact_id:        { type: DataTypes.UUID },
    quote_id:          { type: DataTypes.UUID },
    price_list_id:     { type: DataTypes.UUID },
    order_number:      { type: DataTypes.STRING(20), allowNull: false },
    status:            { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: false, defaultValue: 'draft' },
    payment_condition: { type: DataTypes.ENUM('cash', 'net_30', 'net_60', 'net_90'), allowNull: false, defaultValue: 'cash' },
    currency:          { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    promised_date:     { type: DataTypes.DATE },
    delivered_date:    { type: DataTypes.DATE },
    shipping_street:   { type: DataTypes.STRING(255) },
    shipping_number:   { type: DataTypes.STRING(20) },
    shipping_floor:    { type: DataTypes.STRING(20) },
    shipping_apartment:{ type: DataTypes.STRING(20) },
    shipping_city:     { type: DataTypes.STRING(100) },
    shipping_province: { type: DataTypes.STRING(100) },
    shipping_postal_code: { type: DataTypes.STRING(10) },
    shipping_country:  { type: DataTypes.STRING(100) },
    billing_street:    { type: DataTypes.STRING(255) },
    billing_number:    { type: DataTypes.STRING(20) },
    billing_floor:     { type: DataTypes.STRING(20) },
    billing_apartment: { type: DataTypes.STRING(20) },
    billing_city:      { type: DataTypes.STRING(100) },
    billing_province:  { type: DataTypes.STRING(100) },
    billing_postal_code: { type: DataTypes.STRING(10) },
    billing_country:   { type: DataTypes.STRING(100) },
    subtotal:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:   { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:             { type: DataTypes.TEXT },
    internal_notes:    { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'sales_orders', paranoid: true, underscored: true }
)

SalesOrder.belongsTo(SalesQuote, { foreignKey: 'quote_id', as: 'quote' })
SalesQuote.hasMany(SalesOrder, { foreignKey: 'quote_id', as: 'orders' })

export default SalesOrder
