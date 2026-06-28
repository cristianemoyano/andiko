import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `ALTER TYPE "enum_woocommerce_sync_queue_kind" ADD VALUE IF NOT EXISTS 'import'`,
  )
}

export const down: Migration = async () => {
  // Postgres ENUM values cannot be dropped; 'import' remains. Harmless.
}
