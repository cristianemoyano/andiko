import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export interface WarehouseAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID
  branch_id: UUID | null
  name: string
  description: string | null
  is_active: boolean
}

type WarehouseCreationAttributes = Optional<
  WarehouseAttributes,
  | 'id' | 'branch_id' | 'description' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Warehouse extends AuditModel<WarehouseAttributes, WarehouseCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare branch_id: UUID | null
  declare name: string
  declare description: string | null
  declare is_active: boolean
}

Warehouse.init(
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:   { type: DataTypes.UUID },
    name:        { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    is_active:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'warehouses', paranoid: true, underscored: true }
)

export default Warehouse
