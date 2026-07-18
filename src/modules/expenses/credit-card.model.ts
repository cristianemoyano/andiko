import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const CREDIT_CARD_CURRENCY_MODES = ['ars', 'usd', 'ars_usd'] as const
export type CreditCardCurrencyMode = typeof CREDIT_CARD_CURRENCY_MODES[number]

export interface CreditCardAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID
  branch_id: UUID
  contact_id: UUID | null
  name: string
  last_four: string | null
  currency_mode: CreditCardCurrencyMode
  closing_day: number
  due_day: number
  expense_account_code: string
  is_active: boolean
  notes: string | null
}

type CreditCardCreationAttributes = Optional<
  CreditCardAttributes,
  | 'id' | 'contact_id' | 'last_four' | 'currency_mode' | 'is_active' | 'notes'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CreditCard extends AuditModel<CreditCardAttributes, CreditCardCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID
  declare contact_id: UUID | null
  declare name: string
  declare last_four: string | null
  declare currency_mode: CreditCardCurrencyMode
  declare closing_day: number
  declare due_day: number
  declare expense_account_code: string
  declare is_active: boolean
  declare notes: string | null
}

CreditCard.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:             { type: DataTypes.UUID, allowNull: false },
    contact_id:            { type: DataTypes.UUID },
    name:                  { type: DataTypes.STRING(120), allowNull: false },
    last_four:             { type: DataTypes.STRING(4) },
    currency_mode:         { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ars' },
    closing_day:           { type: DataTypes.INTEGER, allowNull: false },
    due_day:               { type: DataTypes.INTEGER, allowNull: false },
    expense_account_code:  { type: DataTypes.STRING(20), allowNull: false },
    is_active:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes:                 { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'credit_cards', paranoid: true, underscored: true },
)

export default CreditCard
