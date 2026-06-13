import type { Migration } from '../../lib/migrations'

/**
 * Platform-wide (sys-admin) settings — a single row enforced by a UNIQUE
 * `singleton` column that always defaults to TRUE. Currently holds the global
 * SMTP transport + sender identity used to email documents across all orgs.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE platform_settings (
      id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      singleton                BOOLEAN      NOT NULL DEFAULT TRUE,
      smtp_enabled             BOOLEAN      NOT NULL DEFAULT FALSE,
      smtp_host                VARCHAR(255) NOT NULL DEFAULT '',
      smtp_port                INTEGER      NOT NULL DEFAULT 587 CHECK (smtp_port BETWEEN 1 AND 65535),
      smtp_secure              BOOLEAN      NOT NULL DEFAULT FALSE,
      smtp_user                VARCHAR(320) NOT NULL DEFAULT '',
      smtp_password_encrypted  TEXT         NOT NULL DEFAULT '',
      from_name                VARCHAR(255) NOT NULL DEFAULT '',
      from_address             VARCHAR(320) NOT NULL DEFAULT '',
      created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_platform_settings_singleton UNIQUE (singleton)
    );

    INSERT INTO platform_settings (singleton) VALUES (TRUE);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS platform_settings;`)
}
