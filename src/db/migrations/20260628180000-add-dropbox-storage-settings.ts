import type { Migration } from '../../lib/migrations'

/** Adds Dropbox as a platform storage backend (OAuth refresh token + root path). */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP CONSTRAINT IF EXISTS platform_settings_storage_provider_check;

    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_storage_provider_check
        CHECK (storage_provider IN ('s3', 'gdrive', 'dropbox'));

    ALTER TABLE platform_settings
      ADD COLUMN dropbox_app_key                  VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN dropbox_app_secret_encrypted     TEXT         NOT NULL DEFAULT '',
      ADD COLUMN dropbox_refresh_token_encrypted  TEXT         NOT NULL DEFAULT '',
      ADD COLUMN dropbox_root_path                VARCHAR(512) NOT NULL DEFAULT '/andiko';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS dropbox_app_key,
      DROP COLUMN IF EXISTS dropbox_app_secret_encrypted,
      DROP COLUMN IF EXISTS dropbox_refresh_token_encrypted,
      DROP COLUMN IF EXISTS dropbox_root_path;

    ALTER TABLE platform_settings
      DROP CONSTRAINT IF EXISTS platform_settings_storage_provider_check;

    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_storage_provider_check
        CHECK (storage_provider IN ('s3', 'gdrive'));
  `)
}
