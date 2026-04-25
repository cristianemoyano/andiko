import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE products
      ADD COLUMN import_source VARCHAR(32),
      ADD COLUMN import_external_id VARCHAR(64);

    ALTER TABLE product_variants
      ADD COLUMN import_external_id VARCHAR(64);

    CREATE UNIQUE INDEX idx_products_org_source_external_id
      ON products (org_id, import_source, import_external_id)
      WHERE deleted_at IS NULL
        AND import_external_id IS NOT NULL
        AND import_source IS NOT NULL
        AND org_id IS NOT NULL;

    CREATE UNIQUE INDEX idx_product_variants_org_external_row
      ON product_variants (org_id, import_external_id)
      WHERE deleted_at IS NULL
        AND import_external_id IS NOT NULL
        AND org_id IS NOT NULL;

    CREATE TABLE catalog_import_field_maps (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      profile         VARCHAR(64),
      external_header VARCHAR(255) NOT NULL,
      internal_field_key VARCHAR(64) NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX idx_catalog_import_field_maps_org_profile_header
      ON catalog_import_field_maps (org_id, COALESCE(profile, ''), external_header)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_catalog_import_field_maps_org_profile
      ON catalog_import_field_maps (org_id, COALESCE(profile, ''))
      WHERE deleted_at IS NULL;

    CREATE TABLE catalog_import_row_attributes (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      import_source    VARCHAR(32) NOT NULL,
      row_external_id  VARCHAR(64) NOT NULL,
      column_header    VARCHAR(255) NOT NULL,
      value_text       TEXT,
      product_id       UUID REFERENCES products(id) ON DELETE CASCADE,
      variant_id       UUID REFERENCES product_variants(id) ON DELETE CASCADE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at       TIMESTAMPTZ
    );

    CREATE INDEX idx_catalog_import_row_attributes_org_row
      ON catalog_import_row_attributes (org_id, import_source, row_external_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_catalog_import_row_attributes_product
      ON catalog_import_row_attributes (org_id, product_id)
      WHERE product_id IS NOT NULL AND deleted_at IS NULL;

    CREATE INDEX idx_catalog_import_row_attributes_variant
      ON catalog_import_row_attributes (org_id, variant_id)
      WHERE variant_id IS NOT NULL AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS catalog_import_row_attributes;
    DROP TABLE IF EXISTS catalog_import_field_maps;

    DROP INDEX IF EXISTS idx_product_variants_org_external_row;
    DROP INDEX IF EXISTS idx_products_org_source_external_id;

    ALTER TABLE product_variants DROP COLUMN IF EXISTS import_external_id;
    ALTER TABLE products DROP COLUMN IF EXISTS import_external_id;
    ALTER TABLE products DROP COLUMN IF EXISTS import_source;
  `)
}
