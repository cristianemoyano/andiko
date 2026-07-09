import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE notifications (
      id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id               UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      event_key            VARCHAR(64)   NOT NULL,
      actor_id             UUID          REFERENCES users(id) ON DELETE SET NULL,
      recipient_kind       VARCHAR(16)   NOT NULL
                             CHECK (recipient_kind IN ('user', 'contact', 'email')),
      recipient_user_id    UUID          REFERENCES users(id) ON DELETE SET NULL,
      recipient_contact_id UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      recipient_address    VARCHAR(320),
      payload              JSONB         NOT NULL DEFAULT '{}'::jsonb,
      read_at              TIMESTAMPTZ,
      created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at           TIMESTAMPTZ
    );

    CREATE INDEX idx_notifications_org_created
      ON notifications(org_id, created_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_notifications_recipient_user
      ON notifications(org_id, recipient_user_id, created_at DESC)
      WHERE deleted_at IS NULL AND recipient_user_id IS NOT NULL;

    CREATE TABLE notification_deliveries (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      notification_id  UUID          NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      org_id           UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      channel          VARCHAR(16)   NOT NULL
                         CHECK (channel IN ('email', 'in_app', 'push')),
      status           VARCHAR(16)   NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
      subject          VARCHAR(500),
      body_text        TEXT,
      body_html        TEXT,
      transport        VARCHAR(16),
      message_id       VARCHAR(255),
      error            TEXT,
      delivered_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_notification_deliveries_notification
      ON notification_deliveries(notification_id);

    CREATE INDEX idx_notification_deliveries_org_channel_created
      ON notification_deliveries(org_id, channel, created_at DESC);

    CREATE INDEX idx_notification_deliveries_org_status
      ON notification_deliveries(org_id, status)
      WHERE status IN ('pending', 'failed');
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS notification_deliveries;
    DROP TABLE IF EXISTS notifications;
  `)
}
