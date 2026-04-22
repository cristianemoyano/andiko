import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE document_sequences (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      document_type VARCHAR(20) NOT NULL,
      last_number   INT NOT NULL DEFAULT 0,
      CONSTRAINT uq_document_sequences UNIQUE (org_id, document_type)
    );

    CREATE INDEX idx_document_sequences_org ON document_sequences(org_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS document_sequences;`)
}
