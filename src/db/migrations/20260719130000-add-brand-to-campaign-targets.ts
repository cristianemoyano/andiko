import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE campaign_targets ADD COLUMN IF NOT EXISTS brand VARCHAR(120);

    ALTER TABLE campaign_targets DROP CONSTRAINT IF EXISTS chk_campaign_targets_kind;
    ALTER TABLE campaign_targets DROP CONSTRAINT IF EXISTS chk_campaign_targets_ref;

    ALTER TABLE campaign_targets ADD CONSTRAINT chk_campaign_targets_kind
      CHECK (target_kind IN ('category', 'product', 'variant', 'brand'));

    ALTER TABLE campaign_targets ADD CONSTRAINT chk_campaign_targets_ref CHECK (
      (target_kind = 'category' AND category_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL AND brand IS NULL) OR
      (target_kind = 'product'  AND product_id  IS NOT NULL AND category_id IS NULL AND variant_id IS NULL AND brand IS NULL) OR
      (target_kind = 'variant'  AND variant_id  IS NOT NULL AND category_id IS NULL AND product_id IS NULL AND brand IS NULL) OR
      (target_kind = 'brand'    AND brand       IS NOT NULL AND category_id IS NULL AND product_id IS NULL AND variant_id IS NULL)
    );
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DELETE FROM campaign_targets WHERE target_kind = 'brand';

    ALTER TABLE campaign_targets DROP CONSTRAINT IF EXISTS chk_campaign_targets_kind;
    ALTER TABLE campaign_targets DROP CONSTRAINT IF EXISTS chk_campaign_targets_ref;

    ALTER TABLE campaign_targets ADD CONSTRAINT chk_campaign_targets_kind
      CHECK (target_kind IN ('category', 'product', 'variant'));

    ALTER TABLE campaign_targets ADD CONSTRAINT chk_campaign_targets_ref CHECK (
      (target_kind = 'category' AND category_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL) OR
      (target_kind = 'product'  AND product_id  IS NOT NULL AND category_id IS NULL AND variant_id IS NULL) OR
      (target_kind = 'variant'  AND variant_id  IS NOT NULL AND category_id IS NULL AND product_id IS NULL)
    );

    ALTER TABLE campaign_targets DROP COLUMN IF EXISTS brand;
  `)
}
