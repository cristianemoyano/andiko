import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE coupon_redemptions (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      coupon_id       UUID          NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      campaign_id     UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id      UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      document_type   VARCHAR(16)   NOT NULL,
      document_id     UUID          NOT NULL,
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      redeemed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_coupon_redemptions_doc_type CHECK (
        document_type IN ('sales_order', 'invoice', 'quote', 'pos_order')
      )
    );

    CREATE UNIQUE INDEX uq_coupon_redemptions_coupon_doc ON coupon_redemptions(coupon_id, document_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_coupon_redemptions_coupon  ON coupon_redemptions(coupon_id)  WHERE deleted_at IS NULL;
    CREATE INDEX idx_coupon_redemptions_contact ON coupon_redemptions(contact_id) WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_coupon_redemptions_contact;
    DROP INDEX IF EXISTS idx_coupon_redemptions_coupon;
    DROP INDEX IF EXISTS uq_coupon_redemptions_coupon_doc;
    DROP TABLE IF EXISTS coupon_redemptions;
  `)
}
