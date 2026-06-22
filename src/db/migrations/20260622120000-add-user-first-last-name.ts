import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

    UPDATE users
    SET
      first_name = COALESCE(
        NULLIF(split_part(trim(name), ' ', 1), ''),
        trim(name)
      ),
      last_name = CASE
        WHEN strpos(trim(name), ' ') > 0
        THEN trim(substr(trim(name), strpos(trim(name), ' ') + 1))
        ELSE ''
      END
    WHERE first_name IS NULL OR last_name IS NULL;

    ALTER TABLE users
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name SET NOT NULL,
      ALTER COLUMN last_name SET DEFAULT '';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS first_name,
      DROP COLUMN IF EXISTS last_name;
  `)
}
