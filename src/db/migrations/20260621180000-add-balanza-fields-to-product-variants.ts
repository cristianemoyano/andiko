import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE product_variants
      ADD COLUMN sold_by_weight BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN plu_code VARCHAR(20);

    -- PLU must be unique per organization, only for live rows that carry one.
    CREATE UNIQUE INDEX idx_product_variants_org_plu
      ON product_variants(org_id, plu_code)
      WHERE plu_code IS NOT NULL AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_product_variants_org_plu;
    ALTER TABLE product_variants
      DROP COLUMN IF EXISTS plu_code,
      DROP COLUMN IF EXISTS sold_by_weight;
  `)
}
