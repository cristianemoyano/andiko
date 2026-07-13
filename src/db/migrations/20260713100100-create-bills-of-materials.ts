import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE bills_of_materials (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      variant_id       UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      name             VARCHAR(255) NOT NULL,
      output_quantity  NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
      is_active        BOOLEAN NOT NULL DEFAULT true,
      notes            TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_boms_org ON bills_of_materials(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_boms_variant ON bills_of_materials(variant_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_boms_variant_active ON bills_of_materials(variant_id)
      WHERE deleted_at IS NULL AND is_active = true;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS bills_of_materials;
  `)
}
