import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE coupons (
      id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id        UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      code               VARCHAR(40) NOT NULL,
      max_redemptions    INTEGER     CHECK (max_redemptions >= 0),
      redeemed_count     INTEGER     NOT NULL DEFAULT 0,
      per_customer_limit INTEGER     CHECK (per_customer_limit >= 0),
      is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
      updated_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
      deleted_by         UUID        REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX uq_coupons_org_code ON coupons(org_id, code) WHERE deleted_at IS NULL;
    CREATE INDEX idx_coupons_campaign ON coupons(campaign_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_coupons_campaign;
    DROP INDEX IF EXISTS uq_coupons_org_code;
    DROP TABLE IF EXISTS coupons;
  `)
}
