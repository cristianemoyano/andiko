import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE pos_devices (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
      device_id       VARCHAR(128) NOT NULL,
      name            VARCHAR(128),
      api_token       VARCHAR(256) NOT NULL,
      last_seen_at    TIMESTAMPTZ,
      license_valid_until TIMESTAMPTZ,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      CONSTRAINT uq_pos_devices_org_device UNIQUE (org_id, device_id)
    );

    CREATE INDEX idx_pos_devices_org_id ON pos_devices (org_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX idx_pos_devices_api_token ON pos_devices (api_token) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS pos_devices;`)
}
