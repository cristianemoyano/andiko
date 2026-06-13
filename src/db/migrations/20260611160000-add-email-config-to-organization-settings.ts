import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // SMTP transport config (host, port, secure, user, encrypted password, from name/address).
  await queryInterface.addColumn('organization_settings', 'email_settings', {
    type: DataTypes.JSONB,
    allowNull: true,
  })
  // Per-document-type subject/body overrides; defaults live in code.
  await queryInterface.addColumn('organization_settings', 'email_templates', {
    type: DataTypes.JSONB,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('organization_settings', 'email_templates')
  await queryInterface.removeColumn('organization_settings', 'email_settings')
}
