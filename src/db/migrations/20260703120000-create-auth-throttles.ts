import type { Migration } from '@/lib/migrations'

/**
 * Generic attempt-throttle counters (login by email, POS PIN by device+user, etc).
 * One row per throttled key; `locked_until` gates the caller out once `attempt_count`
 * crosses the caller-supplied threshold within the current window. See `src/lib/rate-limit.ts`.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE auth_throttles (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      throttle_key       VARCHAR(255) NOT NULL,
      attempt_count      INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      window_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_until       TIMESTAMPTZ,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX uq_auth_throttles_key ON auth_throttles (throttle_key);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS auth_throttles;
  `)
}
