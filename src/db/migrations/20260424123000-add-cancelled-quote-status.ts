import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'cancelled';
  `)
}

export const down: Migration = async () => {
  // PostgreSQL does not support dropping a single enum value safely.
}
