import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('organization_settings', 'low_stock_alert_recipient_user_ids', {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: false,
    defaultValue: [],
  })

  await queryInterface.addColumn('stock_items', 'last_low_stock_alert_at', {
    type: DataTypes.DATE,
    allowNull: true,
  })

  // Detection (applyMovement) and sending (drainPendingLowStockAlerts) are
  // decoupled: applyMovement enqueues here transactionally (cheap, no I/O);
  // draining happens later, outside any business transaction. No soft-delete —
  // ephemeral state, same criteria as password_reset_tokens/auth_throttles.
  await queryInterface.createTable('low_stock_alert_queue', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
      onDelete: 'CASCADE',
    },
    stock_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'stock_items', key: 'id' },
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('low_stock_alert_queue', ['stock_item_id'], {
    unique: true,
    name: 'uq_low_stock_alert_queue_stock_item_id',
  })
  await queryInterface.addIndex('low_stock_alert_queue', ['org_id'], {
    name: 'idx_low_stock_alert_queue_org_id',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('low_stock_alert_queue')
  await queryInterface.removeColumn('stock_items', 'last_low_stock_alert_at')
  await queryInterface.removeColumn('organization_settings', 'low_stock_alert_recipient_user_ids')
}
