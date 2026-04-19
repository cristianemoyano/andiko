import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import Contact from './contact.model'

export type AddressType = 'fiscal' | 'delivery' | 'commercial'

export interface ContactAddressAttributes {
  id: UUID
  contact_id: UUID
  type: AddressType
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string
  province: string
  postal_code: string | null
  country: string
  is_default: boolean
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

type ContactAddressCreationAttributes = Optional<
  ContactAddressAttributes,
  'id' | 'number' | 'floor' | 'apartment' | 'postal_code' | 'country' | 'is_default' | 'created_at' | 'updated_at' | 'deleted_at'
>

class ContactAddress extends Model<ContactAddressAttributes, ContactAddressCreationAttributes> {
  declare id: UUID
  declare contact_id: UUID
  declare type: AddressType
  declare street: string
  declare number: string | null
  declare floor: string | null
  declare apartment: string | null
  declare city: string
  declare province: string
  declare postal_code: string | null
  declare country: string
  declare is_default: boolean
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

ContactAddress.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contact_id:  { type: DataTypes.UUID, allowNull: false },
    type:        { type: DataTypes.ENUM('fiscal', 'delivery', 'commercial'), allowNull: false },
    street:      { type: DataTypes.STRING(255), allowNull: false },
    number:      { type: DataTypes.STRING(20) },
    floor:       { type: DataTypes.STRING(20) },
    apartment:   { type: DataTypes.STRING(20) },
    city:        { type: DataTypes.STRING(100), allowNull: false },
    province:    { type: DataTypes.STRING(100), allowNull: false },
    postal_code: { type: DataTypes.STRING(10) },
    country:     { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Argentina' },
    is_default:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at:  { type: DataTypes.DATE, allowNull: false },
    updated_at:  { type: DataTypes.DATE, allowNull: false },
    deleted_at:  { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'contact_addresses', paranoid: true, underscored: true }
)

Contact.hasMany(ContactAddress, { foreignKey: 'contact_id', as: 'addresses' })
ContactAddress.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

export default ContactAddress
