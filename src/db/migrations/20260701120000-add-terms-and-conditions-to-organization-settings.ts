import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // Free-text terms & conditions shown to customers/suppliers; org-configurable, plain text.
  await queryInterface.addColumn('organization_settings', 'terms_and_conditions', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('organization_settings', 'terms_and_conditions')
}
