import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('woocommerce_sites', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    // Each site is linked to exactly one branch (site -> 1 branch). A branch may
    // host several sites; they share that branch's warehouse stock.
    branch_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'branches', key: 'id' } },
    name: { type: DataTypes.STRING(255), allowNull: false },
    store_url: { type: DataTypes.STRING(500), allowNull: false },
    consumer_key_encrypted: { type: DataTypes.TEXT, allowNull: false },
    consumer_secret_encrypted: { type: DataTypes.TEXT, allowNull: false },
    webhook_secret_encrypted: { type: DataTypes.TEXT, allowNull: true },
    // Price list whose prices are published to this site.
    price_list_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'price_lists', key: 'id' } },
    // Fallback contact for guest checkouts that have no resolvable customer.
    default_contact_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'contacts', key: 'id' } },
    auto_publish: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    stock_safety_buffer: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_order_synced_at: { type: DataTypes.DATE, allowNull: true },
    last_stock_pushed_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })

  await queryInterface.sequelize.query(
    `ALTER TABLE woocommerce_sites ADD CONSTRAINT chk_woocommerce_sites_safety_buffer
     CHECK (stock_safety_buffer >= 0)`,
  )
  await queryInterface.addIndex('woocommerce_sites', ['org_id'], { name: 'idx_woocommerce_sites_org_id' })
  await queryInterface.addIndex('woocommerce_sites', ['branch_id'], { name: 'idx_woocommerce_sites_branch_id' })
  await queryInterface.addIndex('woocommerce_sites', ['deleted_at'], { name: 'idx_woocommerce_sites_deleted_at' })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('woocommerce_sites')
}
