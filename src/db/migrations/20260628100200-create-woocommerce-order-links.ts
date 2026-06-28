import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('woocommerce_order_links', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    site_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'woocommerce_sites', key: 'id' }, onDelete: 'CASCADE' },
    woo_order_id: { type: DataTypes.BIGINT, allowNull: false },
    sales_order_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'sales_orders', key: 'id' } },
    woo_status: { type: DataTypes.STRING(40), allowNull: true },
    sync_status: {
      type: DataTypes.ENUM('pending', 'synced', 'needs_review', 'error'),
      allowNull: false,
      defaultValue: 'pending',
    },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('woocommerce_order_links', ['org_id'], { name: 'idx_woo_order_links_org_id' })
  await queryInterface.addIndex('woocommerce_order_links', ['site_id'], { name: 'idx_woo_order_links_site_id' })
  await queryInterface.addIndex('woocommerce_order_links', ['sales_order_id'], { name: 'idx_woo_order_links_sales_order_id' })
  await queryInterface.addIndex('woocommerce_order_links', ['sync_status'], { name: 'idx_woo_order_links_sync_status' })
  // Idempotency: one ERP order per (site, woo order).
  await queryInterface.addIndex('woocommerce_order_links', ['site_id', 'woo_order_id'], {
    name: 'uq_woo_order_links_site_order', unique: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('woocommerce_order_links')
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_woocommerce_order_links_sync_status"')
}
