import type { Migration } from '../../lib/migrations'
import { DataTypes } from 'sequelize'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('billing_invoices', 'billed_seats', {
    type: DataTypes.INTEGER,
    allowNull: true,
  })
  await queryInterface.addColumn('billing_invoices', 'billed_branches', {
    type: DataTypes.INTEGER,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('billing_invoices', 'billed_branches')
  await queryInterface.removeColumn('billing_invoices', 'billed_seats')
}
