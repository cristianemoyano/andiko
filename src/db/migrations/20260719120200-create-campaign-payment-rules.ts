import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE campaign_payment_rules (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id       UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      payment_method    VARCHAR(10),
      payment_condition VARCHAR(10),
      wallet            VARCHAR(24),
      card_brand        VARCHAR(16),
      card_type         VARCHAR(8),
      via_qr            BOOLEAN,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
      updated_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
      deleted_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_campaign_payment_rules_method CHECK (
        payment_method IS NULL OR payment_method IN ('cash', 'transfer', 'check', 'card', 'other')
      ),
      CONSTRAINT chk_campaign_payment_rules_condition CHECK (
        payment_condition IS NULL OR payment_condition IN ('cash', 'net_30', 'net_60', 'net_90')
      ),
      CONSTRAINT chk_campaign_payment_rules_card_type CHECK (
        card_type IS NULL OR card_type IN ('credit', 'debit')
      )
    );

    CREATE INDEX idx_campaign_payment_rules_campaign ON campaign_payment_rules(campaign_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_campaign_payment_rules_campaign;
    DROP TABLE IF EXISTS campaign_payment_rules;
  `)
}
