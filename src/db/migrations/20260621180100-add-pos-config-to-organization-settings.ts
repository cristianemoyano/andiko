import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE organization_settings
      ADD COLUMN pos_config JSONB;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE organization_settings
      DROP COLUMN IF EXISTS pos_config;
  `)
}
