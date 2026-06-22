import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'
import type { AfipObservation } from './afip-codes'

export const AFIP_EMISSION_DOC_TYPES = ['invoice', 'credit_note', 'debit_note', 'sales_order'] as const
export type AfipEmissionDocType = typeof AFIP_EMISSION_DOC_TYPES[number]

export const AFIP_EMISSION_STATUSES = ['pending', 'authorized', 'rejected', 'error'] as const
export type AfipEmissionStatus = typeof AFIP_EMISSION_STATUSES[number]

/**
 * Audit + contingency queue for AFIP emission attempts. A row is created per
 * authorize attempt; transport failures stay `pending`/`error` for later retry,
 * AFIP responses are recorded as `authorized` / `rejected`.
 */
export interface AfipEmissionAttributes extends Timestamps, AuditFields {
  id: UUID
  document_type: AfipEmissionDocType
  document_id: UUID
  cbte_tipo: number | null
  punto_venta: number | null
  status: AfipEmissionStatus
  request: Record<string, unknown> | null
  response: Record<string, unknown> | null
  observations: AfipObservation[] | null
  error: string | null
  retries: number
  last_attempt_at: Date | null
}

type AfipEmissionCreationAttributes = Optional<
  AfipEmissionAttributes,
  | 'id' | 'cbte_tipo' | 'punto_venta' | 'status' | 'request' | 'response' | 'observations'
  | 'error' | 'retries' | 'last_attempt_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class AfipEmission extends AuditModel<AfipEmissionAttributes, AfipEmissionCreationAttributes> {
  declare id: UUID
  declare document_type: AfipEmissionDocType
  declare document_id: UUID
  declare cbte_tipo: number | null
  declare punto_venta: number | null
  declare status: AfipEmissionStatus
  declare request: Record<string, unknown> | null
  declare response: Record<string, unknown> | null
  declare observations: AfipObservation[] | null
  declare error: string | null
  declare retries: number
  declare last_attempt_at: Date | null
}

AfipEmission.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    document_type:   { type: DataTypes.STRING(20), allowNull: false },
    document_id:     { type: DataTypes.UUID, allowNull: false },
    cbte_tipo:       { type: DataTypes.SMALLINT },
    punto_venta:     { type: DataTypes.SMALLINT },
    status:          { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    request:         { type: DataTypes.JSONB },
    response:        { type: DataTypes.JSONB },
    observations:    { type: DataTypes.JSONB },
    error:           { type: DataTypes.TEXT },
    retries:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_attempt_at: { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'afip_emissions', paranoid: true, underscored: true },
)

export default AfipEmission
