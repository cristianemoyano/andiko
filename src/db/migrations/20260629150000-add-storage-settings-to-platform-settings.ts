import type { Migration } from '../../lib/migrations'

/**
 * Platform-wide file storage backend (S3 or Google Drive), stored on the singleton
 * `platform_settings` row — same pattern as global SMTP. Secrets are encrypted at rest.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      ADD COLUMN storage_enabled                      BOOLEAN      NOT NULL DEFAULT FALSE,
      ADD COLUMN storage_provider                   VARCHAR(32)  NOT NULL DEFAULT 's3'
        CHECK (storage_provider IN ('s3', 'gdrive', 'dropbox')),
      ADD COLUMN s3_bucket                          VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN s3_region                          VARCHAR(64)  NOT NULL DEFAULT 'us-east-1',
      ADD COLUMN s3_access_key_id                   VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN s3_secret_access_key_encrypted       TEXT         NOT NULL DEFAULT '',
      ADD COLUMN s3_endpoint                          VARCHAR(512) NOT NULL DEFAULT '',
      ADD COLUMN gdrive_service_account_json_encrypted TEXT        NOT NULL DEFAULT '',
      ADD COLUMN gdrive_folder_id                     VARCHAR(255) NOT NULL DEFAULT '';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS storage_enabled,
      DROP COLUMN IF EXISTS storage_provider,
      DROP COLUMN IF EXISTS s3_bucket,
      DROP COLUMN IF EXISTS s3_region,
      DROP COLUMN IF EXISTS s3_access_key_id,
      DROP COLUMN IF EXISTS s3_secret_access_key_encrypted,
      DROP COLUMN IF EXISTS s3_endpoint,
      DROP COLUMN IF EXISTS gdrive_service_account_json_encrypted,
      DROP COLUMN IF EXISTS gdrive_folder_id;
  `)
}
