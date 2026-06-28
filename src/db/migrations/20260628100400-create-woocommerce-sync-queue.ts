import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('woocommerce_sync_queue', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    site_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'woocommerce_sites', key: 'id' }, onDelete: 'CASCADE' },
    // Transactional outbox: rows are written inside the same transaction as the
    // change they describe (e.g. a stock movement), then drained by a worker.
    kind: { type: DataTypes.ENUM('stock', 'product', 'order_ingest'), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status: { type: DataTypes.ENUM('pending', 'done', 'error'), allowNull: false, defaultValue: 'pending' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    next_attempt_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('woocommerce_sync_queue', ['site_id'], { name: 'idx_woo_sync_queue_site_id' })
  // Worker drains pending rows whose next_attempt_at has passed, oldest first.
  await queryInterface.addIndex('woocommerce_sync_queue', ['status', 'next_attempt_at'], {
    name: 'idx_woo_sync_queue_status_next',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('woocommerce_sync_queue')
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_woocommerce_sync_queue_kind"')
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_woocommerce_sync_queue_status"')
}
