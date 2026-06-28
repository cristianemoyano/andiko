import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('woocommerce_order_links', 'woo_order_created_at', {
    type: DataTypes.DATE,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('woocommerce_order_links', 'woo_order_created_at')
}
