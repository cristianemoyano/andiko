import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // Adds a 'processing' state so the worker can atomically claim a job before
  // running it, preventing two concurrent sync ticks from double-processing.
  await queryInterface.sequelize.query(
    `ALTER TYPE "enum_woocommerce_sync_queue_status" ADD VALUE IF NOT EXISTS 'processing'`,
  )
}

export const down: Migration = async () => {
  // Postgres ENUM values cannot be dropped; 'processing' remains. Harmless.
}
