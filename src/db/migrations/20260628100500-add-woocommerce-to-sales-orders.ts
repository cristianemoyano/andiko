import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // Add WooCommerce as a third sales channel alongside 'erp' and 'pos'.
  await queryInterface.sequelize.query(
    `ALTER TYPE "enum_sales_orders_source" ADD VALUE IF NOT EXISTS 'woocommerce'`,
  )

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
  // Note: a Postgres ENUM value cannot be removed; 'woocommerce' remains on the
  // type. This is harmless and consistent with the branch/seat line-kind additions.
}
