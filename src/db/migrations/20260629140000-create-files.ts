import type { Migration } from '../../lib/migrations'

/**
 * File service: vendor-agnostic storage metadata + polymorphic links + ReBAC shares.
 * Bytes live in the storage backend (S3); these tables hold metadata only.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE file_status AS ENUM ('pending', 'available', 'failed');

    -- Stored objects (one row per blob). Tenant isolation by org_id + key prefix.
    CREATE TABLE files (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      storage_provider  VARCHAR(32)  NOT NULL,
      storage_bucket    VARCHAR(255) NOT NULL,
      storage_key       TEXT         NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      content_type      VARCHAR(255) NOT NULL,
      byte_size         BIGINT       NOT NULL CHECK (byte_size >= 0),
      checksum_sha256   VARCHAR(64),
      status            file_status  NOT NULL DEFAULT 'pending',
      uploaded_at       TIMESTAMPTZ,
      org_id            UUID         NOT NULL REFERENCES organizations (id),
      created_by        UUID,
      updated_by        UUID,
      deleted_by        UUID,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX uq_files_storage_key ON files (storage_key) WHERE deleted_at IS NULL;
    CREATE INDEX idx_files_org_id   ON files (org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_files_checksum  ON files (checksum_sha256) WHERE deleted_at IS NULL;

    -- Polymorphic many-to-many: a file linked to any number of owner records.
    CREATE TABLE file_links (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id     UUID NOT NULL REFERENCES files (id) ON DELETE CASCADE,
      owner_type  VARCHAR(64) NOT NULL CHECK (owner_type IN ('invoice', 'product', 'contact')),
      owner_id    UUID NOT NULL,
      role        VARCHAR(64),
      org_id      UUID NOT NULL REFERENCES organizations (id),
      created_by  UUID,
      updated_by  UUID,
      deleted_by  UUID,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    );

    CREATE INDEX idx_file_links_file_id ON file_links (file_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_file_links_owner   ON file_links (owner_type, owner_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_file_links_file_owner
      ON file_links (file_id, owner_type, owner_id) WHERE deleted_at IS NULL;

    -- Explicit ReBAC grants (on top of access inherited from linked records).
    CREATE TABLE file_shares (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id         UUID NOT NULL REFERENCES files (id) ON DELETE CASCADE,
      principal_type  VARCHAR(32) NOT NULL CHECK (principal_type IN ('user', 'org_role', 'branch')),
      principal_id    UUID NOT NULL,
      permission      VARCHAR(16) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
      expires_at      TIMESTAMPTZ,
      org_id          UUID NOT NULL REFERENCES organizations (id),
      created_by      UUID,
      updated_by      UUID,
      deleted_by      UUID,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ
    );

    CREATE INDEX idx_file_shares_file_id   ON file_shares (file_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_file_shares_principal ON file_shares (principal_type, principal_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_file_shares_file_principal
      ON file_shares (file_id, principal_type, principal_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS file_shares;
    DROP TABLE IF EXISTS file_links;
    DROP TABLE IF EXISTS files;
    DROP TYPE IF EXISTS file_status;
  `)
}
