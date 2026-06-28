import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import Contact from './contact.model'

export type AddressType = 'fiscal' | 'delivery' | 'commercial'

export interface ContactAddressAttributes extends Timestamps, AuditFields {
  id: UUID
  contact_id: UUID
  type: AddressType
  street: string
  number: string | null
  second_line: string | null
  floor: string | null
  apartment: string | null
  city: string
  province: string
  postal_code: string | null
  country: string
  is_default: boolean
}

type ContactAddressCreationAttributes = Optional<
  ContactAddressAttributes,
  'id' | 'number' | 'second_line' | 'floor' | 'apartment' | 'postal_code' | 'country' | 'is_default' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ContactAddress extends AuditModel<ContactAddressAttributes, ContactAddressCreationAttributes> {
  declare id: UUID
  declare contact_id: UUID
  declare type: AddressType
  declare street: string
  declare number: string | null
  declare second_line: string | null
  declare floor: string | null
  declare apartment: string | null
  declare city: string
  declare province: string
  declare postal_code: string | null
  declare country: string
  declare is_default: boolean
}

ContactAddress.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contact_id:  { type: DataTypes.UUID, allowNull: false },
    type:        { type: DataTypes.ENUM('fiscal', 'delivery', 'commercial'), allowNull: false },
    street:      { type: DataTypes.STRING(255), allowNull: false },
    number:      { type: DataTypes.STRING(20) },
    second_line: { type: DataTypes.STRING(255) },
    floor:       { type: DataTypes.STRING(20) },
    apartment:   { type: DataTypes.STRING(20) },
    city:        { type: DataTypes.STRING(100), allowNull: false },
    province:    { type: DataTypes.STRING(100), allowNull: false },
    postal_code: { type: DataTypes.STRING(10) },
    country:     { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Argentina' },
    is_default:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'contact_addresses', paranoid: true, underscored: true }
)

// Turbopack/HMR re-evaluates this module; ContactAddress.init() clears only this model's
// associations, while Contact still holds the prior hasMany — re-registering throws on duplicate alias.
if (!Object.prototype.hasOwnProperty.call(Contact.associations, 'addresses')) {
  Contact.hasMany(ContactAddress, { foreignKey: 'contact_id', as: 'addresses' })
}
ContactAddress.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

export default ContactAddress
