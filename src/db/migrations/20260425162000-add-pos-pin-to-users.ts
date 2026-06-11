import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
      ADD COLUMN pos_pin_hash VARCHAR(255);

    CREATE INDEX idx_users_pos_pin_hash
      ON users (pos_pin_hash)
      WHERE deleted_at IS NULL AND pos_pin_hash IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_users_pos_pin_hash;
    ALTER TABLE users DROP COLUMN IF EXISTS pos_pin_hash;
  `)
}

