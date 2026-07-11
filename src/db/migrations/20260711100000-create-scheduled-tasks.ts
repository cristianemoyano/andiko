import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE scheduled_tasks (
      id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                   UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id                UUID          REFERENCES branches(id) ON DELETE SET NULL,
      name                     VARCHAR(200)  NOT NULL,
      description              TEXT,
      action_type              VARCHAR(64)   NOT NULL,
      payload                  JSONB         NOT NULL DEFAULT '{}'::jsonb,
      schedule_kind            VARCHAR(16)   NOT NULL DEFAULT 'cron'
                                 CHECK (schedule_kind IN ('cron')),
      cron_expression          VARCHAR(64)   NOT NULL,
      timezone                 VARCHAR(64)   NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
      status                   VARCHAR(16)   NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'paused', 'disabled')),
      next_run_at              TIMESTAMPTZ   NOT NULL,
      last_run_at              TIMESTAMPTZ,
      last_run_status          VARCHAR(16)
                                 CHECK (last_run_status IN ('success', 'failed', 'skipped')),
      claimed_at               TIMESTAMPTZ,
      claimed_by               VARCHAR(64),
      consecutive_failures     INTEGER       NOT NULL DEFAULT 0,
      max_consecutive_failures INTEGER       NOT NULL DEFAULT 5,
      min_interval_seconds     INTEGER       NOT NULL DEFAULT 60,
      created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at               TIMESTAMPTZ,
      created_by                UUID         REFERENCES users(id) ON DELETE SET NULL,
      updated_by                UUID         REFERENCES users(id) ON DELETE SET NULL,
      deleted_by                UUID         REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_scheduled_tasks_due
      ON scheduled_tasks(status, next_run_at)
      WHERE deleted_at IS NULL AND status = 'active';

    CREATE INDEX idx_scheduled_tasks_org
      ON scheduled_tasks(org_id, created_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_scheduled_tasks_org_action
      ON scheduled_tasks(org_id, action_type)
      WHERE deleted_at IS NULL;

    CREATE TABLE scheduled_task_runs (
      id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      scheduled_task_id  UUID          NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
      org_id             UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      status             VARCHAR(16)   NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'success', 'failed', 'skipped')),
      trigger_kind       VARCHAR(16)   NOT NULL DEFAULT 'scheduled'
                           CHECK (trigger_kind IN ('scheduled', 'manual')),
      started_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      finished_at        TIMESTAMPTZ,
      duration_ms        INTEGER,
      result             JSONB,
      error              TEXT,
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_scheduled_task_runs_task
      ON scheduled_task_runs(scheduled_task_id, started_at DESC);

    CREATE INDEX idx_scheduled_task_runs_org_started
      ON scheduled_task_runs(org_id, started_at DESC);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS scheduled_task_runs;
    DROP TABLE IF EXISTS scheduled_tasks;
  `)
}
