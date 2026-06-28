import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('woocommerce_customer_links', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    site_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'woocommerce_sites', key: 'id' }, onDelete: 'CASCADE' },
    woo_customer_id: { type: DataTypes.BIGINT, allowNull: false },
    contact_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'contacts', key: 'id' } },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('woocommerce_customer_links', ['org_id'], { name: 'idx_woo_customer_links_org_id' })
  await queryInterface.addIndex('woocommerce_customer_links', ['site_id'], { name: 'idx_woo_customer_links_site_id' })
  await queryInterface.addIndex('woocommerce_customer_links', ['contact_id'], { name: 'idx_woo_customer_links_contact_id' })
  await queryInterface.addIndex('woocommerce_customer_links', ['site_id', 'woo_customer_id'], {
    name: 'uq_woo_customer_links_site_customer', unique: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('woocommerce_customer_links')
}
