import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE stock_movement_type AS ENUM (
      'in', 'out', 'adjustment', 'transfer_in', 'transfer_out'
    );

    CREATE TABLE stock_movements (
      id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id       UUID                NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      warehouse_id     UUID                NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
      org_id           UUID                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      movement_type    stock_movement_type NOT NULL,
      reference_type   VARCHAR(50)         NOT NULL,
      reference_id     UUID,
      quantity_delta   NUMERIC(15,4)       NOT NULL,
      quantity_before  NUMERIC(15,4)       NOT NULL,
      quantity_after   NUMERIC(15,4)       NOT NULL,
      notes            TEXT,
      created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
      created_by       UUID                REFERENCES users(id) ON DELETE SET NULL,
      updated_by       UUID                REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_stock_movements_variant    ON stock_movements(variant_id);
    CREATE INDEX idx_stock_movements_warehouse  ON stock_movements(warehouse_id);
    CREATE INDEX idx_stock_movements_org        ON stock_movements(org_id);
    CREATE INDEX idx_stock_movements_reference  ON stock_movements(reference_type, reference_id) WHERE reference_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_stock_movements_reference;
    DROP INDEX IF EXISTS idx_stock_movements_org;
    DROP INDEX IF EXISTS idx_stock_movements_warehouse;
    DROP INDEX IF EXISTS idx_stock_movements_variant;
    DROP TABLE IF EXISTS stock_movements;
    DROP TYPE IF EXISTS stock_movement_type;
  `)
}
