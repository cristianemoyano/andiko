import type { Migration } from '@/lib/migrations'

const DEFAULT_CRON = '0 5 * * *'
const DEFAULT_TZ = 'America/Argentina/Buenos_Aires'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      ADD COLUMN billing_invoice_automation_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
      ADD COLUMN billing_invoice_automation_cron         VARCHAR(64)  NOT NULL DEFAULT '${DEFAULT_CRON}',
      ADD COLUMN billing_invoice_automation_timezone     VARCHAR(64)  NOT NULL DEFAULT '${DEFAULT_TZ}',
      ADD COLUMN billing_invoice_automation_last_run_at  TIMESTAMPTZ,
      ADD COLUMN billing_invoice_automation_last_run_status VARCHAR(16)
        CHECK (billing_invoice_automation_last_run_status IS NULL
          OR billing_invoice_automation_last_run_status IN ('success', 'failed', 'skipped')),
      ADD COLUMN billing_invoice_automation_last_run_summary JSONB,
      ADD COLUMN billing_invoice_automation_next_run_at  TIMESTAMPTZ;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS billing_invoice_automation_enabled,
      DROP COLUMN IF EXISTS billing_invoice_automation_cron,
      DROP COLUMN IF EXISTS billing_invoice_automation_timezone,
      DROP COLUMN IF EXISTS billing_invoice_automation_last_run_at,
      DROP COLUMN IF EXISTS billing_invoice_automation_last_run_status,
      DROP COLUMN IF EXISTS billing_invoice_automation_last_run_summary,
      DROP COLUMN IF EXISTS billing_invoice_automation_next_run_at;
  `)
}
