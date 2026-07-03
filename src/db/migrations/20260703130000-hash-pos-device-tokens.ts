import { createHash } from 'node:crypto'
import { QueryTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * POS device tokens were stored in plaintext (`api_token`), so a DB read (backup, replica,
 * leaked query log) handed out working POS credentials directly. Switch to storing only the
 * SHA-256 hash, matched by hash on each request. Existing devices keep working — the token
 * value handed to each physical device is unchanged, only its stored representation changes.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  const sequelize = queryInterface.sequelize

  await sequelize.query(`ALTER TABLE pos_devices ADD COLUMN api_token_hash VARCHAR(64);`)

  const devices = await sequelize.query<{ id: string; api_token: string }>(
    `SELECT id, api_token FROM pos_devices`,
    { type: QueryTypes.SELECT },
  )
  for (const device of devices) {
    await sequelize.query(
      `UPDATE pos_devices SET api_token_hash = :hash WHERE id = :id`,
      { replacements: { hash: hashToken(device.api_token), id: device.id } },
    )
  }

  await sequelize.query(`
    ALTER TABLE pos_devices ALTER COLUMN api_token_hash SET NOT NULL;
    DROP INDEX IF EXISTS idx_pos_devices_api_token;
    ALTER TABLE pos_devices DROP COLUMN api_token;
    CREATE UNIQUE INDEX idx_pos_devices_api_token_hash ON pos_devices (api_token_hash) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  // Irreversible: the plaintext token cannot be recovered from its hash. Down only restores
  // the column shape (nullable) so the migration can be unwound in dev without losing the table;
  // affected devices would need new tokens issued via the regenerate-token endpoint.
  await queryInterface.sequelize.query(`
    ALTER TABLE pos_devices ADD COLUMN api_token VARCHAR(256);
    DROP INDEX IF EXISTS idx_pos_devices_api_token_hash;
    ALTER TABLE pos_devices DROP COLUMN api_token_hash;
  `)
}
