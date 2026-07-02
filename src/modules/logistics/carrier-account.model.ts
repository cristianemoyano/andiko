import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import { FULFILLMENT_KINDS, type FulfillmentKind } from './logistics.constants'

export interface CarrierAccountAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  kind: FulfillmentKind
  name: string
  is_active: boolean
  credentials_encrypted: string | null
  settings: Record<string, unknown>
}

type CarrierAccountCreationAttributes = Optional<
  CarrierAccountAttributes,
  'id' | 'org_id' | 'branch_id' | 'is_active' | 'credentials_encrypted' | 'settings' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class CarrierAccount extends AuditModel<CarrierAccountAttributes, CarrierAccountCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID | null
  declare kind: FulfillmentKind
  declare name: string
  declare is_active: boolean
  declare credentials_encrypted: string | null
  declare settings: Record<string, unknown>
}

CarrierAccount.init(
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:             { type: DataTypes.UUID },
    kind:                  { type: DataTypes.STRING(40), allowNull: false, validate: { isIn: [[...FULFILLMENT_KINDS]] } },
    name:                  { type: DataTypes.STRING(120), allowNull: false },
    is_active:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    credentials_encrypted: { type: DataTypes.TEXT },
    settings:              { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'carrier_accounts', paranoid: true, underscored: true }
)

export default CarrierAccount
