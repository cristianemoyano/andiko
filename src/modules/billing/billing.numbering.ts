import 'server-only'
import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'

export type BillingDocumentType = 'invoice' | 'payment'

const BILLING_DOC_PREFIXES: Record<BillingDocumentType, string> = {
  invoice: 'BILL',
  payment: 'BPAY',
}

/**
 * Next platform-billing document number (global, not org/branch scoped).
 * Format: `{BILL|BPAY}-{6 dígitos}` (ej. `BILL-000042`).
 * Uses an atomic upsert against `billing_sequences` so concurrent generations
 * never collide.
 */
export async function nextBillingNumber(
  type: BillingDocumentType,
  t: Transaction,
): Promise<string> {
  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO billing_sequences (document_type, last_number)
     VALUES (:type, 1)
     ON CONFLICT (document_type)
     DO UPDATE SET last_number = billing_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { type }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  return `${BILLING_DOC_PREFIXES[type]}-${String(num).padStart(6, '0')}`
}
