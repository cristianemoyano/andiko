import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('woocommerce_product_links', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    site_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'woocommerce_sites', key: 'id' }, onDelete: 'CASCADE' },
    variant_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' } },
    woo_product_id: { type: DataTypes.BIGINT, allowNull: false },
    woo_variation_id: { type: DataTypes.BIGINT, allowNull: true },
    last_pushed_hash: { type: DataTypes.STRING(64), allowNull: true },
    last_pushed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('woocommerce_product_links', ['org_id'], { name: 'idx_woo_product_links_org_id' })
  await queryInterface.addIndex('woocommerce_product_links', ['site_id'], { name: 'idx_woo_product_links_site_id' })
  await queryInterface.addIndex('woocommerce_product_links', ['variant_id'], { name: 'idx_woo_product_links_variant_id' })
  // One ERP variant maps to a single Woo product per site, and vice versa.
  await queryInterface.addIndex('woocommerce_product_links', ['site_id', 'variant_id'], {
    name: 'uq_woo_product_links_site_variant', unique: true,
  })
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX uq_woo_product_links_site_woo
     ON woocommerce_product_links (site_id, woo_product_id, woo_variation_id)`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('woocommerce_product_links')
}
