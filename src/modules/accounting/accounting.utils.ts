import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import type Account from './account.model'

const ENTRY_PREFIX = 'AS'

export const CASH_ACCOUNT_CODE = '1.1.01.01'
export const BANK_ACCOUNT_CODE = '1.1.01.02'

/** Elige Caja o Banco según el medio de pago — 'cash' es la única variante que va a caja. */
export function resolveCashOrBankAccountId(byCode: Map<string, Account>, paymentMethod: string): string | undefined {
  const code = paymentMethod === 'cash' ? CASH_ACCOUNT_CODE : BANK_ACCOUNT_CODE
  return byCode.get(code)?.id
}

/**
 * Siguiente número de asiento por organización.
 * Formato: `AS-{secuencia 6 dígitos}` (ej. `AS-000042`).
 * La contabilidad es a nivel empresa (CUIT), por eso la secuencia es por org,
 * no por sucursal.
 */
export async function nextEntryNumber(orgId: string, t: Transaction): Promise<string> {
  if (!orgId) {
    throw new Error('ORG_CONTEXT_REQUIRED')
  }

  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO accounting_sequences (org_id, last_number)
     VALUES (:orgId, 1)
     ON CONFLICT (org_id)
     DO UPDATE SET last_number = accounting_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  return `${ENTRY_PREFIX}-${String(num).padStart(6, '0')}`
}
