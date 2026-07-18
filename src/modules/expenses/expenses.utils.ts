import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { IvaRate } from '@/types'
import type { ExpenseScheduleFrequency } from './expense-schedule.model'

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

function advanceByCalendarMonths(current: Date, months: number): Date {
  const targetYear  = current.getUTCFullYear()
  const targetMonth = current.getUTCMonth() + months
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(current.getUTCDate(), lastDayOfTargetMonth)

  const next = new Date(current)
  next.setUTCFullYear(targetYear, targetMonth, day)
  return next
}

/**
 * Advances a recurring template's `next_run_date` by its frequency.
 *
 * Calendar-based frequencies clamp to the last day of the target month instead
 * of overflowing (plain `Date.setMonth` arithmetic) — a template anchored on
 * Jan 31 must land on Feb 28/29, not roll over into March, or the anchor day
 * drifts forward permanently on every subsequent cycle.
 */
export function advanceNextRunDate(current: Date, frequency: ExpenseScheduleFrequency): Date {
  if (frequency === 'weekly') {
    const next = new Date(current)
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  if (frequency === 'bimonthly') {
    return advanceByCalendarMonths(current, 2)
  }

  return advanceByCalendarMonths(current, 1)
}

// ─── Financial math (Decimal-safe) ──────────────────────────────────────────

export interface ExpenseTotals {
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
}

export interface ExpenseLineTotals extends ExpenseTotals {
  tax_base: string
}

export function calcExpenseLine(
  quantity: string | number,
  unitPrice: string | number,
  discountPct: string | number,
  ivaRate: IvaRate,
): ExpenseLineTotals {
  const subtotal = new Decimal(quantity).mul(unitPrice)
  const discount = subtotal.mul(discountPct).div(100)
  const taxBase = subtotal.minus(discount)
  const tax = taxBase.mul(new Decimal(ivaRate).div(100))

  return {
    subtotal: subtotal.toFixed(2),
    discount_amount: discount.toFixed(2),
    tax_base: taxBase.toFixed(2),
    tax_amount: tax.toFixed(2),
    total: taxBase.plus(tax).toFixed(2),
  }
}

export function calcExpenseDocumentTotals(lines: ExpenseLineTotals[]): ExpenseTotals {
  const zero = new Decimal(0)
  return {
    subtotal: lines.reduce((sum, line) => sum.plus(line.subtotal), zero).toFixed(2),
    discount_amount: lines.reduce((sum, line) => sum.plus(line.discount_amount), zero).toFixed(2),
    tax_amount: lines.reduce((sum, line) => sum.plus(line.tax_amount), zero).toFixed(2),
    total: lines.reduce((sum, line) => sum.plus(line.total), zero).toFixed(2),
  }
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

/**
 * Derive net/tax from a gross payable total (cuotas sum).
 * `total = (subtotal - discount) * (1 + iva_rate/100)`.
 */
export function calcExpenseTotalsFromGross(
  grossTotal: string | number,
  discount_amount: string | number,
  iva_rate: IvaRate,
): ExpenseTotals {
  const gross    = new Decimal(grossTotal)
  const discount = new Decimal(discount_amount)
  const rate     = new Decimal(iva_rate).div(100)
  const taxBase  = gross.div(rate.plus(1))
  const tax      = gross.minus(taxBase)
  const net      = taxBase.plus(discount)

  return {
    subtotal:        net.toFixed(2),
    discount_amount: discount.toFixed(2),
    tax_amount:      tax.toFixed(2),
    total:           gross.toFixed(2),
  }
}

export interface InstallmentDraft {
  installment_number: number
  due_date: Date
  amount: string
}

/**
 * Builds N installment rows with equal amounts; the last cuota absorbs cent rounding.
 * Due dates advance with the same month-end clamp as recurring schedules.
 */
export function buildInstallmentSchedule(params: {
  count: number
  firstDueDate: Date
  frequency: ExpenseScheduleFrequency
  /** Gross payable total of the plan (sum of cuotas). */
  total: string | number
}): InstallmentDraft[] {
  const count = params.count
  const total = new Decimal(params.total)
  if (count < 1) throw new Error('INSTALLMENT_COUNT_INVALID')
  if (total.lte(0)) throw new Error('INSTALLMENT_TOTAL_INVALID')

  const base = total.div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  const rows: InstallmentDraft[] = []
  let allocated = new Decimal(0)
  let due = new Date(params.firstDueDate)

  for (let i = 1; i <= count; i++) {
    const amount = i === count ? total.minus(allocated) : base
    rows.push({
      installment_number: i,
      due_date: new Date(due),
      amount: amount.toFixed(2),
    })
    allocated = allocated.plus(amount)
    if (i < count) due = advanceNextRunDate(due, params.frequency)
  }

  return rows
}
