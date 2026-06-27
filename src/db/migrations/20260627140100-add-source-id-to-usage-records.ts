import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_records_meter_source
      ON usage_records (subscription_id, metric_key, source_id)
      WHERE deleted_at IS NULL AND source_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_usage_records_meter_source;
    ALTER TABLE usage_records DROP COLUMN IF EXISTS source_id;
  `)
}
