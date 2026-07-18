import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE credit_cards (
      id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id               UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id            UUID          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      contact_id           UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      name                 VARCHAR(120)  NOT NULL,
      last_four            VARCHAR(4),
      currency_mode        VARCHAR(20)   NOT NULL DEFAULT 'ars'
                           CHECK (currency_mode IN ('ars', 'usd', 'ars_usd')),
      closing_day          INTEGER       NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
      due_day              INTEGER       NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
      expense_account_code VARCHAR(20)   NOT NULL,
      is_active            BOOLEAN       NOT NULL DEFAULT true,
      notes                TEXT,
      created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at           TIMESTAMPTZ,
      created_by           UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by           UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by           UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_credit_cards_org_branch
      ON credit_cards(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_credit_cards_active
      ON credit_cards(org_id) WHERE deleted_at IS NULL AND is_active = true;

    CREATE TYPE credit_card_statement_status AS ENUM (
      'draft', 'received', 'partially_paid', 'paid', 'cancelled'
    );

    CREATE TABLE credit_card_statements (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      credit_card_id  UUID NOT NULL REFERENCES credit_cards(id) ON DELETE RESTRICT,
      expense_id      UUID REFERENCES expenses(id) ON DELETE SET NULL,
      period_label    VARCHAR(40) NOT NULL,
      closing_date    TIMESTAMPTZ NOT NULL,
      due_date        TIMESTAMPTZ NOT NULL,
      status          credit_card_statement_status NOT NULL DEFAULT 'draft',
      amount_ars      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_ars >= 0),
      amount_usd      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
      fx_rate         NUMERIC(15,6) CHECK (fx_rate IS NULL OR fx_rate > 0),
      amount_ars_total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_ars_total >= 0),
      paid_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      balance         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_credit_card_statements_period
        UNIQUE (credit_card_id, period_label)
    );

    CREATE INDEX idx_credit_card_statements_card
      ON credit_card_statements(credit_card_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_credit_card_statements_org
      ON credit_card_statements(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_credit_card_statements_due
      ON credit_card_statements(due_date)
      WHERE deleted_at IS NULL AND status IN ('received', 'partially_paid');
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_credit_card_statements_due;
    DROP INDEX IF EXISTS idx_credit_card_statements_org;
    DROP INDEX IF EXISTS idx_credit_card_statements_card;
    DROP TABLE IF EXISTS credit_card_statements;
    DROP TYPE IF EXISTS credit_card_statement_status;

    DROP INDEX IF EXISTS idx_credit_cards_active;
    DROP INDEX IF EXISTS idx_credit_cards_org_branch;
    DROP TABLE IF EXISTS credit_cards;
  `)
}
