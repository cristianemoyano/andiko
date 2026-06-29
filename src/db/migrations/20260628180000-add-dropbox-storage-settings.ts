import type { Migration } from '../../lib/migrations'

/**
 * Adds Dropbox columns to `platform_settings`.
 * Runs before `20260629150000-add-storage-settings-to-platform-settings`; the
 * `storage_provider` check is extended to include `dropbox` in a later migration.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      ADD COLUMN IF NOT EXISTS dropbox_app_key                  VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS dropbox_app_secret_encrypted     TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS dropbox_refresh_token_encrypted  TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS dropbox_root_path                VARCHAR(512) NOT NULL DEFAULT '/andiko';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS dropbox_app_key,
      DROP COLUMN IF EXISTS dropbox_app_secret_encrypted,
      DROP COLUMN IF EXISTS dropbox_refresh_token_encrypted,
      DROP COLUMN IF EXISTS dropbox_root_path;
  `)
}
