import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export interface LowStockAlertQueueAttributes {
  id: UUID
  org_id: UUID
  stock_item_id: UUID
  created_at: Date
}

type LowStockAlertQueueCreationAttributes = Optional<LowStockAlertQueueAttributes, 'id' | 'created_at'>

/**
 * Lightweight, transactional marker written by `applyMovement` whenever a
 * stock item crosses below its minimum. Drained (and deleted) later by
 * `drainPendingLowStockAlerts`, outside any business transaction.
 */
export class LowStockAlertQueue extends Model<LowStockAlertQueueAttributes, LowStockAlertQueueCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare stock_item_id: UUID
  declare created_at: Date
}

LowStockAlertQueue.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: { type: DataTypes.UUID, allowNull: false },
    stock_item_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'low_stock_alert_queue',
    paranoid: false,
    underscored: true,
    updatedAt: false,
  },
)

export default LowStockAlertQueue
