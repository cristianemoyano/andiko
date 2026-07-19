import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export type ContactType = 'customer' | 'supplier' | 'both'
export type IvaCondition = 'responsable_inscripto' | 'monotributista' | 'consumidor_final' | 'exento' | 'no_responsable'
export type ContactSystemKey = 'consumidor_final'

export interface ContactAttributes extends Timestamps, AuditFields {
  id: UUID
  type: ContactType
  legal_name: string
  trade_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  cuit: string | null
  iva_condition: IvaCondition
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  is_system: boolean
  system_key: ContactSystemKey | null
  import_source: string | null
  import_external_id: string | null
}

type ContactCreationAttributes = Optional<
  ContactAttributes,
  'id' | 'trade_name' | 'first_name' | 'last_name' | 'job_title' | 'cuit' | 'email' | 'phone' | 'notes' | 'is_active' |
  'is_system' | 'system_key' |
  'import_source' | 'import_external_id' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Contact extends AuditModel<ContactAttributes, ContactCreationAttributes> {
  declare id: UUID
  declare type: ContactType
  declare legal_name: string
  declare trade_name: string | null
  declare first_name: string | null
  declare last_name: string | null
  declare job_title: string | null
  declare cuit: string | null
  declare iva_condition: IvaCondition
  declare email: string | null
  declare phone: string | null
  declare notes: string | null
  declare is_active: boolean
  declare is_system: boolean
  declare system_key: ContactSystemKey | null
  declare import_source: string | null
  declare import_external_id: string | null
}

Contact.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type:          { type: DataTypes.ENUM('customer', 'supplier', 'both'), allowNull: false },
    legal_name:    { type: DataTypes.STRING(255), allowNull: false },
    trade_name:    { type: DataTypes.STRING(255) },
    first_name:    { type: DataTypes.STRING(100) },
    last_name:     { type: DataTypes.STRING(100) },
    job_title:     { type: DataTypes.STRING(120) },
    cuit:          { type: DataTypes.STRING(13) },
    iva_condition: { type: DataTypes.ENUM('responsable_inscripto', 'monotributista', 'consumidor_final', 'exento', 'no_responsable'), allowNull: false },
    email:         { type: DataTypes.STRING(255) },
    phone:         { type: DataTypes.STRING(50) },
    notes:         { type: DataTypes.TEXT },
    is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_system:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    system_key:    { type: DataTypes.STRING(64), allowNull: true },
    import_source:     { type: DataTypes.STRING(32) },
    import_external_id: { type: DataTypes.STRING(64) },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'contacts', paranoid: true, underscored: true }
)

export default Contact
