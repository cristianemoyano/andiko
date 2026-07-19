import type { Migration } from '../../lib/migrations'

const SYSTEM_KEY = 'consumidor_final'
const LEGAL_NAME = 'Consumidor Final'

export const up: Migration = async ({ context: queryInterface }) => {
  const sequelize = queryInterface.sequelize

  await sequelize.query(`
    ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS system_key VARCHAR(64);
  `)

  // Promote an existing compatible CF contact per org (prefer exact legal_name match).
  await sequelize.query(
    `
    WITH candidates AS (
      SELECT DISTINCT ON (c.org_id)
        c.id,
        c.org_id
      FROM contacts c
      WHERE c.deleted_at IS NULL
        AND c.org_id IS NOT NULL
        AND c.type IN ('customer', 'both')
        AND c.iva_condition = 'consumidor_final'
        AND c.cuit IS NULL
        AND lower(c.legal_name) = lower(:legalName)
      ORDER BY c.org_id, c.created_at ASC
    )
    UPDATE contacts c
    SET is_system = TRUE,
        system_key = :systemKey,
        updated_at = NOW()
    FROM candidates cand
    WHERE c.id = cand.id
      AND NOT EXISTS (
        SELECT 1 FROM contacts other
        WHERE other.org_id = cand.org_id
          AND other.system_key = :systemKey
          AND other.deleted_at IS NULL
      )
    `,
    { replacements: { legalName: LEGAL_NAME, systemKey: SYSTEM_KEY } },
  )

  // Insert CF system contact for orgs that still lack one.
  await sequelize.query(
    `
    INSERT INTO contacts (
      id, org_id, type, legal_name, trade_name, cuit, iva_condition,
      is_active, is_system, system_key, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      o.id,
      'customer',
      :legalName,
      NULL,
      NULL,
      'consumidor_final',
      TRUE,
      TRUE,
      :systemKey,
      NOW(),
      NOW()
    FROM organizations o
    WHERE o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.org_id = o.id
          AND c.system_key = :systemKey
          AND c.deleted_at IS NULL
      )
    `,
    { replacements: { legalName: LEGAL_NAME, systemKey: SYSTEM_KEY } },
  )

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_org_system_key
      ON contacts (org_id, system_key)
      WHERE system_key IS NOT NULL AND deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_contacts_org_system
      ON contacts (org_id)
      WHERE is_system = TRUE AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_contacts_org_system;
    DROP INDEX IF EXISTS uq_contacts_org_system_key;
    ALTER TABLE contacts DROP COLUMN IF EXISTS system_key;
    ALTER TABLE contacts DROP COLUMN IF EXISTS is_system;
  `)
}
