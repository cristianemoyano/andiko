import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

/**
 * SMTP configuration moved from per-org (`organization_settings.email_settings`)
 * to the global `platform_settings` table, managed by sys-admin. The per-org
 * `email_templates` column stays — templates remain per-organization.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('organization_settings', 'email_settings')
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('organization_settings', 'email_settings', {
    type: DataTypes.JSONB,
    allowNull: true,
  })
}
