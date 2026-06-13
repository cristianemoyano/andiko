import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted');

    CREATE TABLE journal_entries (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entry_number VARCHAR(20) NOT NULL,
      entry_date   DATE NOT NULL,
      description  TEXT,
      status       journal_entry_status NOT NULL DEFAULT 'draft',
      source_type  VARCHAR(30),
      source_id    UUID,
      total_debit  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_debit >= 0),
      total_credit NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ,
      created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by   UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX uq_journal_entries_number_org ON journal_entries(entry_number, org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_journal_entries_org_id ON journal_entries(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_journal_entries_date   ON journal_entries(entry_date) WHERE deleted_at IS NULL;
    CREATE INDEX idx_journal_entries_status ON journal_entries(status)     WHERE deleted_at IS NULL;

    CREATE TABLE journal_entry_lines (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,
      description VARCHAR(255),
      debit       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
      credit      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
      sort_order  INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID,
      updated_by  UUID,
      deleted_by  UUID,
      CONSTRAINT chk_journal_entry_lines_debit_xor_credit CHECK (debit = 0 OR credit = 0)
    );

    CREATE INDEX idx_journal_entry_lines_entry   ON journal_entry_lines(entry_id)   WHERE deleted_at IS NULL;
    CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(account_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_journal_entry_lines_branch  ON journal_entry_lines(branch_id)  WHERE deleted_at IS NULL;

    CREATE TABLE accounting_sequences (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      last_number INT NOT NULL DEFAULT 0,
      CONSTRAINT uq_accounting_sequences UNIQUE (org_id)
    );
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS accounting_sequences;
    DROP TABLE IF EXISTS journal_entry_lines;
    DROP TABLE IF EXISTS journal_entries;
    DROP TYPE IF EXISTS journal_entry_status;
  `)
}
