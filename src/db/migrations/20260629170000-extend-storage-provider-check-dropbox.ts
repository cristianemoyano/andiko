import type { Migration } from '../../lib/migrations'

/** Allow `dropbox` as a platform storage provider (after base storage columns exist). */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'platform_settings'
          AND column_name = 'storage_provider'
      ) THEN
        ALTER TABLE platform_settings
          DROP CONSTRAINT IF EXISTS platform_settings_storage_provider_check;

        ALTER TABLE platform_settings
          ADD CONSTRAINT platform_settings_storage_provider_check
            CHECK (storage_provider IN ('s3', 'gdrive', 'dropbox'));
      END IF;
    END $$;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'platform_settings'
          AND column_name = 'storage_provider'
      ) THEN
        ALTER TABLE platform_settings
          DROP CONSTRAINT IF EXISTS platform_settings_storage_provider_check;

        ALTER TABLE platform_settings
          ADD CONSTRAINT platform_settings_storage_provider_check
            CHECK (storage_provider IN ('s3', 'gdrive'));
      END IF;
    END $$;
  `)
}
