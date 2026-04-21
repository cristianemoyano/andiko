import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE price_lists (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      name        VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      is_default  BOOLEAN NOT NULL DEFAULT FALSE,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID,
      updated_by  UUID,
      deleted_by  UUID
    );

    CREATE UNIQUE INDEX idx_price_lists_one_default
      ON price_lists(org_id)
      WHERE is_default = TRUE AND deleted_at IS NULL;

    CREATE INDEX idx_price_lists_org_id ON price_lists(org_id) WHERE deleted_at IS NULL;

    CREATE TABLE price_list_items (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      price_list_id      UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
      product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      org_id             UUID REFERENCES organizations(id) ON DELETE SET NULL,
      price              NUMERIC(15,2) NOT NULL CHECK (price >= 0),
      valid_from         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID,
      updated_by         UUID,
      deleted_by         UUID
    );

    CREATE UNIQUE INDEX idx_price_list_items_active
      ON price_list_items(price_list_id, product_variant_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_price_list_items_list    ON price_list_items(price_list_id)      WHERE deleted_at IS NULL;
    CREATE INDEX idx_price_list_items_variant ON price_list_items(product_variant_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_price_list_items_org_id  ON price_list_items(org_id)             WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS price_list_items;
    DROP TABLE IF EXISTS price_lists;
  `)
}
