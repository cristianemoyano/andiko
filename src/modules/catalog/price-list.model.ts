import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

interface PriceListAttributes extends Timestamps, AuditFields {
  id: UUID
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
}

type PriceListCreationAttributes = Optional<
  PriceListAttributes,
  'id' | 'description' | 'is_default' | 'is_active' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class PriceList extends AuditModel<PriceListAttributes, PriceListCreationAttributes> {
  declare id: UUID
  declare name: string
  declare description: string | null
  declare is_default: boolean
  declare is_active: boolean
}

PriceList.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:        { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.STRING(255) },
    is_default:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'price_lists', paranoid: true, underscored: true }
)

export default PriceList
