import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Contact from './contact.model'

export type AccountType = 'checking' | 'savings'

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Cuenta corriente',
  savings:  'Caja de ahorro',
}

export interface ContactPaymentInfoAttributes extends Timestamps, AuditFields {
  id: UUID
  contact_id: UUID
  bank_name: string | null
  cbu: string | null
  alias: string | null
  account_type: AccountType | null
  is_default: boolean
}

type ContactPaymentInfoCreationAttributes = Optional<
  ContactPaymentInfoAttributes,
  'id' | 'bank_name' | 'cbu' | 'alias' | 'account_type' | 'is_default' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ContactPaymentInfo extends AuditModel<ContactPaymentInfoAttributes, ContactPaymentInfoCreationAttributes> {
  declare id: UUID
  declare contact_id: UUID
  declare bank_name: string | null
  declare cbu: string | null
  declare alias: string | null
  declare account_type: AccountType | null
  declare is_default: boolean
}

ContactPaymentInfo.init(
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contact_id:   { type: DataTypes.UUID, allowNull: false },
    bank_name:    { type: DataTypes.STRING(100) },
    cbu:          { type: DataTypes.STRING(22), unique: true },
    alias:        { type: DataTypes.STRING(100) },
    account_type: { type: DataTypes.STRING(20) },
    is_default:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'contact_payment_info', paranoid: true, underscored: true }
)

// Turbopack/HMR re-evaluates this module; ContactPaymentInfo.init() clears only this model's
// associations, while Contact still holds the prior hasMany — re-registering throws on duplicate alias.
if (!Object.prototype.hasOwnProperty.call(Contact.associations, 'payment_info')) {
  Contact.hasMany(ContactPaymentInfo, { foreignKey: 'contact_id', as: 'payment_info' })
}
ContactPaymentInfo.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

export default ContactPaymentInfo
