import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE bom_items (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      bom_id                UUID NOT NULL REFERENCES bills_of_materials(id) ON DELETE CASCADE,
      component_variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      quantity              NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      scrap_pct             NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (scrap_pct >= 0 AND scrap_pct < 100),
      sort_order            INTEGER NOT NULL DEFAULT 0,
      notes                 TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_bom_items_bom ON bom_items(bom_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_bom_items_org ON bom_items(org_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_bom_items_bom_component ON bom_items(bom_id, component_variant_id)
      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS bom_items;
  `)
}
