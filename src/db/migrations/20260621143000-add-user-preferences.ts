import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
      ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS preferences;
  `)
}
