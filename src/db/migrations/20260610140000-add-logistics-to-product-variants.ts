import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE product_variants
      ADD COLUMN weight_kg NUMERIC(10, 3) CHECK (weight_kg IS NULL OR weight_kg >= 0),
      ADD COLUMN length_cm NUMERIC(10, 2) CHECK (length_cm IS NULL OR length_cm >= 0),
      ADD COLUMN width_cm NUMERIC(10, 2) CHECK (width_cm IS NULL OR width_cm >= 0),
      ADD COLUMN height_cm NUMERIC(10, 2) CHECK (height_cm IS NULL OR height_cm >= 0),
      ADD COLUMN units_per_package INTEGER CHECK (units_per_package IS NULL OR units_per_package >= 1);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE product_variants
      DROP COLUMN IF EXISTS weight_kg,
      DROP COLUMN IF EXISTS length_cm,
      DROP COLUMN IF EXISTS width_cm,
      DROP COLUMN IF EXISTS height_cm,
      DROP COLUMN IF EXISTS units_per_package;
  `)
}
