import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE production_orders (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id          UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      warehouse_id       UUID REFERENCES warehouses(id) ON DELETE RESTRICT,
      order_number       VARCHAR(30) NOT NULL,
      bom_id             UUID NOT NULL REFERENCES bills_of_materials(id) ON DELETE RESTRICT,
      variant_id         UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'released', 'in_process', 'done', 'cancelled')),
      planned_quantity   NUMERIC(15,4) NOT NULL CHECK (planned_quantity > 0),
      produced_quantity  NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
      scheduled_date     DATE,
      released_at        TIMESTAMPTZ,
      started_at         TIMESTAMPTZ,
      completed_at       TIMESTAMPTZ,
      cancelled_at       TIMESTAMPTZ,
      notes              TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_production_orders_org ON production_orders(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_production_orders_org_branch ON production_orders(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_production_orders_status ON production_orders(org_id, status) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_production_orders_number ON production_orders(org_id, order_number) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS production_orders;
  `)
}
