import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE email_logs
      ADD COLUMN notification_delivery_id UUID
        REFERENCES notification_deliveries(id) ON DELETE SET NULL;

    CREATE INDEX idx_email_logs_notification_delivery
      ON email_logs(notification_delivery_id)
      WHERE notification_delivery_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_email_logs_notification_delivery;
    ALTER TABLE email_logs DROP COLUMN IF EXISTS notification_delivery_id;
  `)
}
