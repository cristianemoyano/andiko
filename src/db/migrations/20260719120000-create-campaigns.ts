import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE campaigns (
      id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id                  UUID         REFERENCES branches(id) ON DELETE SET NULL,
      name                       VARCHAR(120) NOT NULL,
      description                TEXT,
      terms                      TEXT,
      reward_kind                VARCHAR(16)  NOT NULL,
      reward_percent             NUMERIC(5,2) CHECK (reward_percent >= 0 AND reward_percent <= 100),
      installments_count         SMALLINT     CHECK (installments_count > 0),
      installments_interest_free BOOLEAN,
      requires_coupon            BOOLEAN      NOT NULL DEFAULT FALSE,
      stackable                  BOOLEAN      NOT NULL DEFAULT FALSE,
      priority                   SMALLINT     NOT NULL DEFAULT 100,
      min_purchase_amount        NUMERIC(15,2) CHECK (min_purchase_amount >= 0),
      valid_from                 TIMESTAMPTZ  NOT NULL,
      valid_to                   TIMESTAMPTZ  NOT NULL,
      active_weekdays            SMALLINT[],
      active_time_from           TIME,
      active_time_to             TIME,
      channels                   VARCHAR(10)[],
      is_active                  BOOLEAN      NOT NULL DEFAULT TRUE,
      max_uses                   INTEGER      CHECK (max_uses >= 0),
      uses_count                 INTEGER      NOT NULL DEFAULT 0,
      created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      deleted_at                 TIMESTAMPTZ,
      created_by                 UUID         REFERENCES users(id) ON DELETE SET NULL,
      updated_by                 UUID         REFERENCES users(id) ON DELETE SET NULL,
      deleted_by                 UUID         REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_campaigns_reward_kind CHECK (reward_kind IN ('percent', 'installments')),
      CONSTRAINT chk_campaigns_reward_integrity CHECK (
        (reward_kind = 'percent'      AND reward_percent IS NOT NULL) OR
        (reward_kind = 'installments' AND installments_count IS NOT NULL)
      ),
      CONSTRAINT chk_campaigns_validity CHECK (valid_to > valid_from)
    );

    CREATE INDEX idx_campaigns_org    ON campaigns(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_campaigns_active ON campaigns(org_id, is_active, valid_from, valid_to) WHERE deleted_at IS NULL;
    CREATE INDEX idx_campaigns_branch ON campaigns(branch_id) WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_campaigns_branch;
    DROP INDEX IF EXISTS idx_campaigns_active;
    DROP INDEX IF EXISTS idx_campaigns_org;
    DROP TABLE IF EXISTS campaigns;
  `)
}
