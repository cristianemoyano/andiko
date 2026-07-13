import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE attendance_events (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id         UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      event_type        VARCHAR(20) NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'absence')),
      occurred_at       TIMESTAMPTZ NOT NULL,
      work_date         DATE NOT NULL,
      source            VARCHAR(20) NOT NULL CHECK (source IN ('self_service', 'manual', 'device_import')),
      note              TEXT,
      corrects_event_id UUID REFERENCES attendance_events(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_attendance_events_org_branch ON attendance_events(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_attendance_events_employee_date ON attendance_events(employee_id, work_date) WHERE deleted_at IS NULL;

    CREATE UNIQUE INDEX uq_attendance_events_device_dedup
      ON attendance_events(employee_id, event_type, occurred_at)
      WHERE deleted_at IS NULL AND source = 'device_import';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS attendance_events;
  `)
}
