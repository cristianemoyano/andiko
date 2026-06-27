import type { Migration } from '../../lib/migrations'

/**
 * Structured address for branches. The legacy free-text `address` column is
 * kept and is now derived (a composed one-line string) so existing readers
 * (e.g. sales document snapshots) keep working, while the structured fields
 * back richer features (maps, fiscal headers, shipping). All nullable.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE branches
      ADD COLUMN street      VARCHAR(255),
      ADD COLUMN number      VARCHAR(20),
      ADD COLUMN floor       VARCHAR(20),
      ADD COLUMN apartment   VARCHAR(20),
      ADD COLUMN city        VARCHAR(100),
      ADD COLUMN province    VARCHAR(100),
      ADD COLUMN postal_code VARCHAR(10),
      ADD COLUMN country     VARCHAR(100);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE branches
      DROP COLUMN IF EXISTS street,
      DROP COLUMN IF EXISTS number,
      DROP COLUMN IF EXISTS floor,
      DROP COLUMN IF EXISTS apartment,
      DROP COLUMN IF EXISTS city,
      DROP COLUMN IF EXISTS province,
      DROP COLUMN IF EXISTS postal_code,
      DROP COLUMN IF EXISTS country;
  `)
}
