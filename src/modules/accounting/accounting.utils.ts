import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { TenantContext } from '@/lib/tenancy'
import type Account from './account.model'

const ENTRY_PREFIX = 'AS'

export const CASH_ACCOUNT_CODE = '1.1.01.01'
export const BANK_ACCOUNT_CODE = '1.1.01.02'

export type AccountingContext = { orgId: string; userId: string | null }

export function toAccountingContext(ctx: TenantContext): AccountingContext {
  return { orgId: ctx.orgId!, userId: auditUserId(ctx.userId) }
}

export function auditUserId(userId: string | null | undefined): string | null {
  return userId || null
}

/** Deriva el neto imputable desde total e IVA (fuente de verdad = total). */
export function deriveNetFromTotalAndTax(total: Decimal, tax: Decimal): Decimal {
  return total.minus(tax)
}

export function assertBalancedLines(lines: { debit: string; credit: string }[]): void {
  const totalDebit = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))
  if (totalDebit.lte(0)) throw new Error('ENTRY_EMPTY')
  if (!totalDebit.equals(totalCredit)) throw new Error('ENTRY_NOT_BALANCED')
}

export type AccountPick = Pick<Account, 'id' | 'code' | 'is_active' | 'is_postable'>

export function resolveRequiredAccounts(
  accounts: AccountPick[],
  requiredCodes: readonly string[],
): { ok: true; byCode: Map<string, AccountPick> } | { ok: false; missingCodes: string[] } {
  const activePostable = accounts.filter(a => a.is_active && a.is_postable)
  const byCode = new Map(activePostable.map(a => [a.code, a]))
  const missingCodes = requiredCodes.filter(code => !byCode.has(code))
  if (missingCodes.length > 0) return { ok: false, missingCodes }
  return { ok: true, byCode }
}

/** Elige Caja o Banco según el medio de pago — 'cash' es la única variante que va a caja. */
export function resolveCashOrBankAccountId(
  byCode: Map<string, Pick<Account, 'id'>>,
  paymentMethod: string,
): string | undefined {
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
