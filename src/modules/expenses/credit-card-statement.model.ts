import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import CreditCard from './credit-card.model'

export const CREDIT_CARD_STATEMENT_STATUSES = [
  'draft', 'received', 'partially_paid', 'paid', 'cancelled',
] as const
export type CreditCardStatementStatus = typeof CREDIT_CARD_STATEMENT_STATUSES[number]

export interface CreditCardStatementAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID
  branch_id: UUID
  credit_card_id: UUID
  expense_id: UUID | null
  period_label: string
  closing_date: Date
  due_date: Date
  status: CreditCardStatementStatus
  amount_ars: string
  amount_usd: string
  fx_rate: string | null
  amount_ars_total: string
  paid_amount: string
  balance: string
  notes: string | null
}

type CreditCardStatementCreationAttributes = Optional<
  CreditCardStatementAttributes,
  | 'id' | 'expense_id' | 'status' | 'amount_ars' | 'amount_usd' | 'fx_rate'
  | 'amount_ars_total' | 'paid_amount' | 'balance' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CreditCardStatement extends AuditModel<
  CreditCardStatementAttributes,
  CreditCardStatementCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID
  declare credit_card_id: UUID
  declare expense_id: UUID | null
  declare period_label: string
  declare closing_date: Date
  declare due_date: Date
  declare status: CreditCardStatementStatus
  declare amount_ars: string
  declare amount_usd: string
  declare fx_rate: string | null
  declare amount_ars_total: string
  declare paid_amount: string
  declare balance: string
  declare notes: string | null
}

CreditCardStatement.init(
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:        { type: DataTypes.UUID, allowNull: false },
    credit_card_id:   { type: DataTypes.UUID, allowNull: false },
    expense_id:       { type: DataTypes.UUID },
    period_label:     { type: DataTypes.STRING(40), allowNull: false },
    closing_date:     { type: DataTypes.DATE, allowNull: false },
    due_date:         { type: DataTypes.DATE, allowNull: false },
    status:           {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    amount_ars:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    amount_usd:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    fx_rate:          { type: DataTypes.DECIMAL(15, 6) },
    amount_ars_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    paid_amount:      { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    balance:          { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    notes:            { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'credit_card_statements', paranoid: true, underscored: true },
)

CreditCard.hasMany(CreditCardStatement, { foreignKey: 'credit_card_id', as: 'statements' })
CreditCardStatement.belongsTo(CreditCard, { foreignKey: 'credit_card_id', as: 'credit_card' })

export default CreditCardStatement
