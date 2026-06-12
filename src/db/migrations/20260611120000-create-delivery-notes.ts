import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE delivery_notes (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id       UUID         REFERENCES branches(id) ON DELETE SET NULL,
      order_id        UUID         REFERENCES sales_orders(id) ON DELETE SET NULL,
      contact_id      UUID         REFERENCES contacts(id) ON DELETE SET NULL,
      warehouse_id    UUID         REFERENCES warehouses(id) ON DELETE SET NULL,
      issued_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
      delivery_number VARCHAR(20)  NOT NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'issued', 'delivered', 'annulled')),
      deducts_stock   BOOLEAN      NOT NULL DEFAULT TRUE,
      delivery_date   TIMESTAMPTZ,
      carrier         VARCHAR(255),
      tracking_code   VARCHAR(100),
      ship_to_address TEXT,
      notes           TEXT,
      internal_notes  TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_delivery_notes_number_org UNIQUE (org_id, delivery_number)
    );

    CREATE INDEX idx_delivery_notes_org        ON delivery_notes(org_id)       WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_notes_branch     ON delivery_notes(branch_id)    WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
    CREATE INDEX idx_delivery_notes_order      ON delivery_notes(order_id)     WHERE deleted_at IS NULL AND order_id IS NOT NULL;
    CREATE INDEX idx_delivery_notes_contact    ON delivery_notes(contact_id)   WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
    CREATE INDEX idx_delivery_notes_warehouse  ON delivery_notes(warehouse_id) WHERE deleted_at IS NULL AND warehouse_id IS NOT NULL;

    CREATE TABLE delivery_note_items (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_note_id UUID          NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
      org_id           UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      order_item_id    UUID          REFERENCES sales_order_items(id) ON DELETE SET NULL,
      product_id       UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id       UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description      VARCHAR(500)  NOT NULL,
      quantity         NUMERIC(15,4) NOT NULL CHECK (quantity >= 0),
      sort_order       INTEGER       NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at       TIMESTAMPTZ,
      created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by       UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_delivery_note_items_note    ON delivery_note_items(delivery_note_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_note_items_org     ON delivery_note_items(org_id)           WHERE deleted_at IS NULL;
    CREATE INDEX idx_delivery_note_items_order_item ON delivery_note_items(order_item_id) WHERE deleted_at IS NULL AND order_item_id IS NOT NULL;
    CREATE INDEX idx_delivery_note_items_variant ON delivery_note_items(variant_id)       WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_delivery_note_items_variant;
    DROP INDEX IF EXISTS idx_delivery_note_items_order_item;
    DROP INDEX IF EXISTS idx_delivery_note_items_org;
    DROP INDEX IF EXISTS idx_delivery_note_items_note;
    DROP TABLE IF EXISTS delivery_note_items;

    DROP INDEX IF EXISTS idx_delivery_notes_warehouse;
    DROP INDEX IF EXISTS idx_delivery_notes_contact;
    DROP INDEX IF EXISTS idx_delivery_notes_order;
    DROP INDEX IF EXISTS idx_delivery_notes_branch;
    DROP INDEX IF EXISTS idx_delivery_notes_org;
    DROP TABLE IF EXISTS delivery_notes;
  `)
}
