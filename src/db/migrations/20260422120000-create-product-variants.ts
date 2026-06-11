import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE product_variants (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      org_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
      sku            VARCHAR(100) NOT NULL,
      barcode        VARCHAR(100),
      name           VARCHAR(255),
      is_default     BOOLEAN NOT NULL DEFAULT FALSE,
      cost_price     NUMERIC(15,2),
      base_price     NUMERIC(15,2),
      manage_stock   BOOLEAN NOT NULL DEFAULT TRUE,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID,
      updated_by     UUID,
      deleted_by     UUID,
      CHECK (cost_price     IS NULL OR cost_price     >= 0),
      CHECK (base_price     IS NULL OR base_price     >= 0),
      CHECK (stock_quantity >= 0),
      UNIQUE (sku, org_id)
    );

    CREATE UNIQUE INDEX idx_product_variants_one_default
      ON product_variants(product_id)
      WHERE is_default = TRUE AND deleted_at IS NULL;

    CREATE INDEX idx_product_variants_product_id ON product_variants(product_id)       WHERE deleted_at IS NULL;
    CREATE INDEX idx_product_variants_sku        ON product_variants(sku, org_id)      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS product_variants;
  `)
}
