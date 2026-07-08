import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE delivery_runs (
      id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id             UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id          UUID          NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      run_number         VARCHAR(20)   NOT NULL,
      status             VARCHAR(20)   NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled')),
      planned_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
      assigned_driver_id UUID          REFERENCES users(id) ON DELETE SET NULL,
      vehicle_id         UUID          REFERENCES vehicles(id) ON DELETE SET NULL,
      vehicle_ref        VARCHAR(60),
      carrier_account_id UUID          REFERENCES carrier_accounts(id) ON DELETE RESTRICT,
      provider_kind      VARCHAR(40)   NOT NULL DEFAULT 'in_house'
                           CHECK (provider_kind IN ('in_house', 'andreani', 'correo_argentino', 'oca', 'manual')),
      dispatched_at      TIMESTAMPTZ,
      completed_at       TIMESTAMPTZ,
      notes              TEXT,
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_delivery_runs_number_org UNIQUE (org_id, run_number)
    );

    CREATE INDEX idx_delivery_runs_org_status ON delivery_runs(org_id, status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_runs_branch_date ON delivery_runs(branch_id, planned_date) WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_runs_driver ON delivery_runs(assigned_driver_id)
      WHERE assigned_driver_id IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE delivery_stops (
      id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_run_id    UUID          NOT NULL REFERENCES delivery_runs(id) ON DELETE CASCADE,
      org_id             UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      sequence           INTEGER       NOT NULL CHECK (sequence > 0),
      contact_id         UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      ship_to_name       VARCHAR(160),
      ship_to_phone      VARCHAR(40),
      ship_street        VARCHAR(255),
      ship_number        VARCHAR(20),
      ship_floor         VARCHAR(20),
      ship_apartment     VARCHAR(20),
      ship_city          VARCHAR(100),
      ship_province      VARCHAR(100),
      ship_postal_code   VARCHAR(10),
      ship_country       VARCHAR(100)  NOT NULL DEFAULT 'Argentina',
      status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'arrived', 'delivered', 'failed', 'skipped')),
      delivered_at       TIMESTAMPTZ,
      failure_reason     TEXT,
      cod_expected_amount NUMERIC(15,2) CHECK (cod_expected_amount IS NULL OR cod_expected_amount >= 0),
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by         UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX uq_delivery_stops_run_sequence
      ON delivery_stops(delivery_run_id, sequence)
      WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_stops_run ON delivery_stops(delivery_run_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_stops_contact ON delivery_stops(contact_id)
      WHERE contact_id IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE delivery_stop_shipments (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_run_id UUID        NOT NULL REFERENCES delivery_runs(id) ON DELETE CASCADE,
      delivery_stop_id UUID       NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
      shipment_id     UUID        NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID        REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX uq_delivery_stop_shipments_shipment_active
      ON delivery_stop_shipments(shipment_id)
      WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_stop_shipments_run
      ON delivery_stop_shipments(delivery_run_id)
      WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_stop_shipments_stop
      ON delivery_stop_shipments(delivery_stop_id)
      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS delivery_stop_shipments;
    DROP TABLE IF EXISTS delivery_stops;
    DROP TABLE IF EXISTS delivery_runs;
  `)
}
