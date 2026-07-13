import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE production_order_lines (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      order_id              UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
      component_variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      planned_quantity      NUMERIC(15,4) NOT NULL CHECK (planned_quantity >= 0),
      consumed_quantity     NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
      sort_order            INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_production_order_lines_order ON production_order_lines(order_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_production_order_lines_org ON production_order_lines(org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS production_order_lines;
  `)
}
