import type { QueryInterface } from 'sequelize'
import { DataTypes } from 'sequelize'

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.addColumn('sales_orders', 'issue_date', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'fiscal_ticket_number', {
    type: DataTypes.STRING(32),
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'cae', {
    type: DataTypes.STRING(14),
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'cae_expiration', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'comprobante_tipo', {
    type: DataTypes.SMALLINT,
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'punto_venta', {
    type: DataTypes.SMALLINT,
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'cbte_numero', {
    type: DataTypes.INTEGER,
    allowNull: true,
  })
  await queryInterface.addColumn('sales_orders', 'afip_status', {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'not_sent',
  })
  await queryInterface.addColumn('sales_orders', 'afip_observations', {
    type: DataTypes.JSONB,
    allowNull: true,
  })
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.removeColumn('sales_orders', 'afip_observations')
  await queryInterface.removeColumn('sales_orders', 'afip_status')
  await queryInterface.removeColumn('sales_orders', 'cbte_numero')
  await queryInterface.removeColumn('sales_orders', 'punto_venta')
  await queryInterface.removeColumn('sales_orders', 'comprobante_tipo')
  await queryInterface.removeColumn('sales_orders', 'cae_expiration')
  await queryInterface.removeColumn('sales_orders', 'cae')
  await queryInterface.removeColumn('sales_orders', 'fiscal_ticket_number')
  await queryInterface.removeColumn('sales_orders', 'issue_date')
}
