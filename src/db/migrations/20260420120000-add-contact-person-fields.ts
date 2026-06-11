import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS job_title VARCHAR(120);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts
      DROP COLUMN IF EXISTS first_name,
      DROP COLUMN IF EXISTS last_name,
      DROP COLUMN IF EXISTS job_title;
  `)
}
