import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { IvaRate } from '@/types'

// ─── Document numbering ──────────────────────────────────────────────────────
// Uses the same org+branch `document_sequences` table as purchases, with its
// own document types — no cross-module import of purchases.utils.

type ExpenseDocType = 'expense' | 'expense_payment'

const DOC_PREFIXES: Record<ExpenseDocType, string> = {
  expense:         'EXP',
  expense_payment: 'PEXP',
}

/**
 * Siguiente número de documento de Expensas por organización + sucursal.
 * Formato: `{EXP|PEXP}-{branch_code 2 dígitos}-{secuencia 4 dígitos}` (ej. `EXP-01-0001`).
 */
export async function nextExpenseDocNumber(
  orgId: string,
  branchId: string,
  type: ExpenseDocType,
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

// ─── Recurrence ──────────────────────────────────────────────────────────────

/**
 * Advances a recurring template's `next_run_date` by its frequency.
 *
 * `monthly` clamps to the last day of the target month instead of overflowing
 * (plain `Date.setMonth` arithmetic) — a template anchored on Jan 31 must land
 * on Feb 28/29, not roll over into March, or the anchor day drifts forward
 * permanently on every subsequent cycle.
 */
export function advanceNextRunDate(current: Date, frequency: 'monthly' | 'weekly'): Date {
  if (frequency === 'weekly') {
    const next = new Date(current)
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  const targetYear  = current.getUTCFullYear()
  const targetMonth = current.getUTCMonth() + 1
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(current.getUTCDate(), lastDayOfTargetMonth)

  const next = new Date(current)
  next.setUTCFullYear(targetYear, targetMonth, day)
  return next
}

// ─── Financial math (Decimal-safe) ──────────────────────────────────────────

export interface ExpenseTotals {
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
}

/** Single-line expense totals: net amount, discount, and IVA over `subtotal - discount_amount`. */
export function calcExpenseTotals(
  subtotal: string | number,
  discount_amount: string | number,
  iva_rate: IvaRate,
): ExpenseTotals {
  const net      = new Decimal(subtotal)
  const discount = new Decimal(discount_amount)
  const rate     = new Decimal(iva_rate).div(100)
  const taxBase  = net.minus(discount)
  const tax      = taxBase.mul(rate)
  const total    = taxBase.plus(tax)

  return {
    subtotal:        net.toFixed(2),
    discount_amount: discount.toFixed(2),
    tax_amount:      tax.toFixed(2),
    total:           total.toFixed(2),
  }
}
