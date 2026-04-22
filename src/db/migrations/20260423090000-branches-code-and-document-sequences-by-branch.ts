import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_code INTEGER;

    UPDATE branches b
    SET branch_code = sq.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at ASC, id ASC)::int AS rn
      FROM branches
      WHERE deleted_at IS NULL
    ) sq
    WHERE b.id = sq.id AND b.deleted_at IS NULL;

    UPDATE branches SET branch_code = 1 WHERE branch_code IS NULL;

    ALTER TABLE branches ALTER COLUMN branch_code SET NOT NULL;
    ALTER TABLE branches ADD CONSTRAINT branches_branch_code_chk
      CHECK (branch_code >= 1 AND branch_code <= 9999);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_branch_code_active
      ON branches (org_id, branch_code)
      WHERE deleted_at IS NULL;

    ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS uq_document_sequences;

    ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

    DELETE FROM document_sequences;

    INSERT INTO document_sequences (org_id, branch_id, document_type, last_number)
    SELECT b.org_id, b.id, dt.document_type, 0
    FROM branches b
    CROSS JOIN (
      VALUES ('quote'::varchar), ('order'), ('invoice'), ('payment')
    ) AS dt(document_type)
    WHERE b.deleted_at IS NULL;

    ALTER TABLE document_sequences ALTER COLUMN branch_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_document_sequences_org_branch_type
      ON document_sequences (org_id, branch_id, document_type);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_document_sequences_org_branch_type;
    ALTER TABLE document_sequences DROP COLUMN IF EXISTS branch_id;
    ALTER TABLE document_sequences ADD CONSTRAINT uq_document_sequences UNIQUE (org_id, document_type);

    DROP INDEX IF EXISTS idx_branches_org_branch_code_active;
    ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_branch_code_chk;
    ALTER TABLE branches DROP COLUMN IF EXISTS branch_code;
  `)
}
