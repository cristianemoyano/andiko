import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE vehicles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,
      label       VARCHAR(120) NOT NULL,
      plate       VARCHAR(20),
      notes       TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_vehicles_label_nonempty CHECK (length(trim(label)) > 0)
    );

    CREATE INDEX idx_vehicles_org ON vehicles(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_vehicles_branch ON vehicles(branch_id) WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

    ALTER TABLE shipments
      ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

    CREATE INDEX idx_shipments_vehicle ON shipments(vehicle_id)
      WHERE vehicle_id IS NOT NULL AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_shipments_vehicle;
    ALTER TABLE shipments DROP COLUMN IF EXISTS vehicle_id;
    DROP TABLE IF EXISTS vehicles;
  `)
}
