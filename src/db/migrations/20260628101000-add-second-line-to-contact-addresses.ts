import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contact_addresses
      ADD COLUMN second_line VARCHAR(255);

    UPDATE contact_addresses
    SET second_line = NULLIF(
      TRIM(BOTH FROM CONCAT_WS(', ',
        NULLIF(TRIM(floor), ''),
        NULLIF(TRIM(apartment), '')
      )),
      ''
    )
    WHERE second_line IS NULL
      AND (floor IS NOT NULL OR apartment IS NOT NULL);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contact_addresses DROP COLUMN IF EXISTS second_line;
  `)
}
