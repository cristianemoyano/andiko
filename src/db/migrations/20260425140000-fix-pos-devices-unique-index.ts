import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE pos_devices DROP CONSTRAINT IF EXISTS uq_pos_devices_org_device;
    DROP INDEX IF EXISTS uq_pos_devices_org_device;

    CREATE UNIQUE INDEX uq_pos_devices_org_device
      ON pos_devices (org_id, device_id)
      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_pos_devices_org_device;

    ALTER TABLE pos_devices
      ADD CONSTRAINT uq_pos_devices_org_device UNIQUE (org_id, device_id);
  `)
}
