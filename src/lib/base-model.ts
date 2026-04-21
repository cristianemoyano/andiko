import { Model, DataTypes } from 'sequelize'
import type { Timestamps, AuditFields, UUID } from '@/types'

export type OrgScoped = { org_id: UUID | null }

export abstract class AuditModel<
  TAttr extends Timestamps & AuditFields & OrgScoped,
  TCreate extends Record<string, unknown>,
> extends Model<TAttr, TCreate> {
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
  declare created_by: UUID | null
  declare updated_by: UUID | null
  declare deleted_by: UUID | null
  declare org_id: UUID | null
}

export const auditColumnDefs = {
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
  deleted_at: { type: DataTypes.DATE },
  created_by: { type: DataTypes.UUID },
  updated_by: { type: DataTypes.UUID },
  deleted_by: { type: DataTypes.UUID },
  org_id:     { type: DataTypes.UUID },
} as const
