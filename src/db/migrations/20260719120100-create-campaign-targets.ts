import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE campaign_targets (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      target_kind  VARCHAR(10) NOT NULL,
      category_id  UUID        REFERENCES product_categories(id) ON DELETE CASCADE,
      product_id   UUID        REFERENCES products(id) ON DELETE CASCADE,
      variant_id   UUID        REFERENCES product_variants(id) ON DELETE CASCADE,
      is_exclusion BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ,
      created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
      updated_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
      deleted_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_campaign_targets_kind CHECK (target_kind IN ('category', 'product', 'variant')),
      CONSTRAINT chk_campaign_targets_ref CHECK (
        (target_kind = 'category' AND category_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL) OR
        (target_kind = 'product'  AND product_id  IS NOT NULL AND category_id IS NULL AND variant_id IS NULL) OR
        (target_kind = 'variant'  AND variant_id  IS NOT NULL AND category_id IS NULL AND product_id IS NULL)
      )
    );

    CREATE INDEX idx_campaign_targets_campaign ON campaign_targets(campaign_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_campaign_targets_category ON campaign_targets(category_id) WHERE deleted_at IS NULL AND category_id IS NOT NULL;
    CREATE INDEX idx_campaign_targets_product  ON campaign_targets(product_id)  WHERE deleted_at IS NULL AND product_id IS NOT NULL;
    CREATE INDEX idx_campaign_targets_variant  ON campaign_targets(variant_id)  WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_campaign_targets_variant;
    DROP INDEX IF EXISTS idx_campaign_targets_product;
    DROP INDEX IF EXISTS idx_campaign_targets_category;
    DROP INDEX IF EXISTS idx_campaign_targets_campaign;
    DROP TABLE IF EXISTS campaign_targets;
  `)
}
