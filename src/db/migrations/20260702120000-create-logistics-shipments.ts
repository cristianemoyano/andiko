import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE carrier_accounts (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id             UUID          REFERENCES branches(id) ON DELETE SET NULL,
      kind                  VARCHAR(40)   NOT NULL
                              CHECK (kind IN ('in_house', 'andreani', 'correo_argentino', 'oca', 'manual')),
      name                  VARCHAR(120)  NOT NULL,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      credentials_encrypted TEXT,
      settings              JSONB         NOT NULL DEFAULT '{}',
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ,
      created_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by            UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_carrier_accounts_org    ON carrier_accounts(org_id)    WHERE deleted_at IS NULL;
    CREATE INDEX idx_carrier_accounts_branch ON carrier_accounts(branch_id) WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE shipments (
      id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id             UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id          UUID          NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      sales_order_id     UUID          NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
      carrier_account_id UUID          REFERENCES carrier_accounts(id) ON DELETE RESTRICT,
      warehouse_id       UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
      shipment_number    VARCHAR(20)   NOT NULL,
      status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'ready_to_ship', 'dispatched', 'in_transit',
                                             'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled')),
      provider_kind      VARCHAR(40)   NOT NULL
                           CHECK (provider_kind IN ('in_house', 'andreani', 'correo_argentino', 'oca', 'manual')),
      tracking_number    VARCHAR(120),
      tracking_url       TEXT,
      label_url          TEXT,
      assigned_driver_id UUID          REFERENCES users(id) ON DELETE SET NULL,
      vehicle_ref        VARCHAR(60),
      shipping_cost      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
      currency           VARCHAR(3)    NOT NULL DEFAULT 'ARS',
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
      promised_date      DATE,
      dispatched_at      TIMESTAMPTZ,
      delivered_at       TIMESTAMPTZ,
      delivery_notes     TEXT,
      failure_reason     TEXT,
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_shipments_number_org UNIQUE (org_id, shipment_number)
    );

    CREATE INDEX idx_shipments_order      ON shipments(sales_order_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_shipments_org_status ON shipments(org_id, status)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_shipments_branch     ON shipments(branch_id)          WHERE deleted_at IS NULL;
    CREATE INDEX idx_shipments_carrier    ON shipments(carrier_account_id) WHERE carrier_account_id IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX idx_shipments_warehouse  ON shipments(warehouse_id)       WHERE warehouse_id IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX idx_shipments_driver     ON shipments(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX idx_shipments_tracking   ON shipments(tracking_number)    WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE shipment_items (
      id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id         UUID          NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      org_id              UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      sales_order_item_id UUID          NOT NULL REFERENCES sales_order_items(id) ON DELETE RESTRICT,
      description         VARCHAR(500)  NOT NULL,
      quantity            NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at          TIMESTAMPTZ,
      created_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by          UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_shipment_items_shipment   ON shipment_items(shipment_id)         WHERE deleted_at IS NULL;
    CREATE INDEX idx_shipment_items_order_item ON shipment_items(sales_order_item_id) WHERE deleted_at IS NULL;

    -- Append-only tracking timeline: no updated_at/deleted_at by design (events are immutable).
    CREATE TABLE shipment_events (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID         NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      org_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      status      VARCHAR(20)  NOT NULL
                    CHECK (status IN ('pending', 'ready_to_ship', 'dispatched', 'in_transit',
                                      'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled')),
      description VARCHAR(255),
      occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      source      VARCHAR(20)  NOT NULL DEFAULT 'system'
                    CHECK (source IN ('system', 'manual', 'webhook', 'poll')),
      raw         JSONB,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      created_by  UUID         REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_shipment_events_shipment ON shipment_events(shipment_id, occurred_at);

    ALTER TABLE sales_order_items
      ADD COLUMN IF NOT EXISTS shipped_qty NUMERIC(15,4) NOT NULL DEFAULT 0;

    ALTER TABLE sales_order_items
      DROP CONSTRAINT IF EXISTS chk_sales_order_items_shipped_qty;

    ALTER TABLE sales_order_items
      ADD CONSTRAINT chk_sales_order_items_shipped_qty
      CHECK (shipped_qty >= 0 AND shipped_qty <= quantity);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_order_items DROP CONSTRAINT IF EXISTS chk_sales_order_items_shipped_qty;
    ALTER TABLE sales_order_items DROP COLUMN IF EXISTS shipped_qty;

    DROP TABLE IF EXISTS shipment_events;
    DROP TABLE IF EXISTS shipment_items;
    DROP TABLE IF EXISTS shipments;
    DROP TABLE IF EXISTS carrier_accounts;
  `)
}
