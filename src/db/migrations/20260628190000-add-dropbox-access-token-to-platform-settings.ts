import type { Migration } from '../../lib/migrations'

/** Optional generated access token for Dropbox dev setup (alternative to refresh token). */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      ADD COLUMN dropbox_access_token_encrypted TEXT NOT NULL DEFAULT '';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS dropbox_access_token_encrypted;
  `)
}
