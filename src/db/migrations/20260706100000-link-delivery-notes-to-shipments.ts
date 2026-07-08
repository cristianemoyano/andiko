import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_notes
      ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_delivery_notes_shipment
      ON delivery_notes(shipment_id)
      WHERE deleted_at IS NULL AND shipment_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_notes_active_shipment
      ON delivery_notes(shipment_id)
      WHERE deleted_at IS NULL AND shipment_id IS NOT NULL AND status <> 'annulled';

    ALTER TABLE delivery_note_items
      ADD COLUMN IF NOT EXISTS shipment_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_delivery_note_items_shipment_item
      ON delivery_note_items(shipment_item_id)
      WHERE deleted_at IS NULL AND shipment_item_id IS NOT NULL;

    ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS delivery_result_reason VARCHAR(60),
      ADD COLUMN IF NOT EXISTS delivery_result_notes TEXT;

    ALTER TABLE delivery_stops
      DROP CONSTRAINT IF EXISTS delivery_stops_status_check;

    ALTER TABLE delivery_stops
      ADD CONSTRAINT delivery_stops_status_check
      CHECK (status IN ('pending', 'arrived', 'delivered', 'partial', 'failed', 'returned', 'skipped'));

    ALTER TABLE delivery_stops
      ADD COLUMN IF NOT EXISTS delivery_result_reason VARCHAR(60),
      ADD COLUMN IF NOT EXISTS delivery_result_notes TEXT;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_stops
      DROP COLUMN IF EXISTS delivery_result_notes,
      DROP COLUMN IF EXISTS delivery_result_reason;

    ALTER TABLE delivery_stops
      DROP CONSTRAINT IF EXISTS delivery_stops_status_check;

    ALTER TABLE delivery_stops
      ADD CONSTRAINT delivery_stops_status_check
      CHECK (status IN ('pending', 'arrived', 'delivered', 'failed', 'skipped'));

    ALTER TABLE shipments
      DROP COLUMN IF EXISTS delivery_result_notes,
      DROP COLUMN IF EXISTS delivery_result_reason;

    DROP INDEX IF EXISTS idx_delivery_note_items_shipment_item;
    ALTER TABLE delivery_note_items
      DROP COLUMN IF EXISTS shipment_item_id;

    DROP INDEX IF EXISTS uq_delivery_notes_active_shipment;
    DROP INDEX IF EXISTS idx_delivery_notes_shipment;
    ALTER TABLE delivery_notes
      DROP COLUMN IF EXISTS shipment_id;
  `)
}
