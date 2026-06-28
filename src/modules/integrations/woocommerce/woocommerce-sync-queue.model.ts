import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export const WOO_SYNC_KINDS = ['stock', 'product', 'order_ingest'] as const
export type WooSyncKind = typeof WOO_SYNC_KINDS[number]

export const WOO_SYNC_STATUSES = ['pending', 'processing', 'done', 'error'] as const
export type WooSyncStatus = typeof WOO_SYNC_STATUSES[number]

export interface WoocommerceSyncQueueAttributes {
  id: UUID
  org_id: UUID
  site_id: UUID
  kind: WooSyncKind
  payload: Record<string, unknown>
  status: WooSyncStatus
  attempts: number
  next_attempt_at: Date
  last_error: string | null
  created_at: Date
  updated_at: Date
}

type WoocommerceSyncQueueCreationAttributes = Optional<
  WoocommerceSyncQueueAttributes,
  'id' | 'payload' | 'status' | 'attempts' | 'next_attempt_at' | 'last_error' | 'created_at' | 'updated_at'
>

class WoocommerceSyncQueue extends Model<
  WoocommerceSyncQueueAttributes,
  WoocommerceSyncQueueCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare site_id: UUID
  declare kind: WooSyncKind
  declare payload: Record<string, unknown>
  declare status: WooSyncStatus
  declare attempts: number
  declare next_attempt_at: Date
  declare last_error: string | null
  declare created_at: Date
  declare updated_at: Date
}

WoocommerceSyncQueue.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:          { type: DataTypes.UUID, allowNull: false },
    site_id:         { type: DataTypes.UUID, allowNull: false },
    kind:            { type: DataTypes.ENUM(...WOO_SYNC_KINDS), allowNull: false },
    payload:         { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status:          { type: DataTypes.ENUM(...WOO_SYNC_STATUSES), allowNull: false, defaultValue: 'pending' },
    attempts:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    next_attempt_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    last_error:      { type: DataTypes.TEXT },
    created_at:      { type: DataTypes.DATE, allowNull: false },
    updated_at:      { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'woocommerce_sync_queue', paranoid: false, underscored: true }
)

export default WoocommerceSyncQueue
