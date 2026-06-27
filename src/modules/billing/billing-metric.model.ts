import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export interface BillingMetricAttributes extends Timestamps, AuditFields {
  id: UUID
  key: string
  label: string
  unit_label: string | null
  unit_price: string
  is_active: boolean
}

type BillingMetricCreationAttributes = Optional<
  BillingMetricAttributes,
  | 'id' | 'unit_label' | 'unit_price' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class BillingMetric extends AuditModel<BillingMetricAttributes, BillingMetricCreationAttributes> {
  declare id: UUID
  declare key: string
  declare label: string
  declare unit_label: string | null
  declare unit_price: string
  declare is_active: boolean
}

BillingMetric.init(
  {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key:        { type: DataTypes.STRING(50), allowNull: false },
    label:      { type: DataTypes.STRING(255), allowNull: false },
    unit_label: { type: DataTypes.STRING(50) },
    unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: '0.00' },
    is_active:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'billing_metrics', paranoid: true, underscored: true }
)

export default BillingMetric
