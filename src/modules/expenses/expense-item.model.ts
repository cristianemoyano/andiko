import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields, IvaRate } from '@/types'

export interface ExpenseItemAttributes extends Timestamps, AuditFields {
  id: UUID
  expense_id: UUID
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  expense_account_code: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

type ExpenseItemCreationAttributes = Optional<
  ExpenseItemAttributes,
  | 'id' | 'discount_pct' | 'iva_rate' | 'subtotal' | 'discount_amount'
  | 'tax_amount' | 'total' | 'sort_order'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ExpenseItem extends AuditModel<ExpenseItemAttributes, ExpenseItemCreationAttributes> {
  declare id: UUID
  declare expense_id: UUID
  declare description: string
  declare quantity: string
  declare unit_price: string
  declare discount_pct: string
  declare iva_rate: IvaRate
  declare expense_account_code: string
  declare subtotal: string
  declare discount_amount: string
  declare tax_amount: string
  declare total: string
  declare sort_order: number
}

ExpenseItem.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    expense_id:            { type: DataTypes.UUID, allowNull: false },
    description:           { type: DataTypes.STRING(500), allowNull: false },
    quantity:              { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    unit_price:            { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount_pct:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: '0' },
    iva_rate:              { type: DataTypes.STRING(10), allowNull: false, defaultValue: '21' },
    expense_account_code:  { type: DataTypes.STRING(20), allowNull: false },
    subtotal:              { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    discount_amount:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    tax_amount:            { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    total:                 { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    sort_order:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'expense_items', paranoid: true, underscored: true },
)

export default ExpenseItem
