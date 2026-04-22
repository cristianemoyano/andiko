import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'

export { calcLineItem, calcDocumentTotals } from './sales.math'
export type { LineItemTotals, DocumentTotals } from './sales.math'

type DocumentType = 'quote' | 'order' | 'invoice' | 'payment'

const DOC_PREFIXES: Record<DocumentType, string> = {
  quote:   'PRES',
  order:   'PED',
  invoice: 'FAC',
  payment: 'COB',
}

export async function nextDocumentNumber(
  orgId: string,
  type: DocumentType,
  t: Transaction,
): Promise<string> {
  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO document_sequences (org_id, document_type, last_number)
     VALUES (:orgId, :type, 1)
     ON CONFLICT (org_id, document_type)
     DO UPDATE SET last_number = document_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId, type }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  return `${DOC_PREFIXES[type]}-${String(num).padStart(4, '0')}`
}
