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

/**
 * Siguiente número de documento por organización + sucursal.
 * Formato: `{PRES|PED|FAC|COB}-{branch_code 2 dígitos}-{secuencia 4 dígitos}` (ej. `PRES-01-0042`).
 */
export async function nextDocumentNumber(
  orgId: string,
  branchId: string,
  type: DocumentType,
  t: Transaction,
): Promise<string> {
  if (!orgId || !branchId) {
    throw new Error('ORG_CONTEXT_REQUIRED')
  }

  const { default: Branch } = await import('@/modules/auth/branch.model')
  const branch = await Branch.findOne({
    where: { id: branchId, org_id: orgId, is_active: true },
    attributes: ['branch_code'],
    transaction: t,
  })
  if (!branch) {
    throw new Error('BRANCH_NOT_FOUND')
  }

  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO document_sequences (org_id, branch_id, document_type, last_number)
     VALUES (:orgId, :branchId, :type, 1)
     ON CONFLICT (org_id, branch_id, document_type)
     DO UPDATE SET last_number = document_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId, branchId, type }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  const bc = String(branch.branch_code).padStart(2, '0')
  return `${DOC_PREFIXES[type]}-${bc}-${String(num).padStart(4, '0')}`
}
