import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // source is VARCHAR + CHECK (see 20260425154500), not a Postgres ENUM.
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS chk_sales_orders_source;
    ALTER TABLE sales_orders
      ADD CONSTRAINT chk_sales_orders_source
      CHECK (source IN ('erp', 'pos', 'woocommerce'));
  `)

  // Denormalized link to the originating site for channel reporting/filtering
  // (mirrors pos_device_id/pos_sale_id). The woo_order_id lives in
  // woocommerce_order_links.
  await queryInterface.addColumn('sales_orders', 'channel_site_id', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'woocommerce_sites', key: 'id' },
  })
  await queryInterface.addIndex('sales_orders', ['channel_site_id'], {
    name: 'idx_sales_orders_channel_site_id',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('sales_orders', 'channel_site_id')
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS chk_sales_orders_source;
    ALTER TABLE sales_orders
      ADD CONSTRAINT chk_sales_orders_source
      CHECK (source IN ('erp', 'pos'));
  `)
}
