import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import Account from './account.model'
import { ensureAccountingAssociations } from './accounting-associations'
import { AUTO_POST_ACCOUNT_CODES } from './default-chart'
import {
  createPostedEntry,
  deriveNetFromTotalAndTax,
  logAutoPostSkipped,
  resolveRequiredAccounts,
  toAccountingContext,
  type AutoPostLine,
} from './accounting-auto-post.utils'
import { buildReversalLines } from './period-close.utils'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Expense from '@/modules/expenses/expense.model'
import ExpenseItem from '@/modules/expenses/expense-item.model'
import ExpenseInstallment from '@/modules/expenses/expense-installment.model'

const EXPENSE_INVOICE_SOURCE = 'expense_invoice'
const EXPENSE_INVOICE_REVERSAL_SOURCE = 'expense_invoice_reversal'

/**
 * Entries for this expense that haven't been reversed yet. An entry is
 * considered reversed when a `expense_invoice_reversal` entry points at its id.
 */
async function findActiveExpenseInvoiceEntries(
  orgId: string,
  expenseId: string,
  t: Transaction,
): Promise<JournalEntry[]> {
  const entries = await JournalEntry.findAll({
    where: { org_id: orgId, source_type: EXPENSE_INVOICE_SOURCE, source_id: expenseId },
    transaction: t,
  })
  if (entries.length === 0) return []

  const reversals = await JournalEntry.findAll({
    where: {
      org_id: orgId,
      source_type: EXPENSE_INVOICE_REVERSAL_SOURCE,
      source_id: entries.map(e => e.id),
    },
    attributes: ['source_id'],
    transaction: t,
  })
  const reversedIds = new Set(reversals.map(r => String(r.source_id)))
  return entries.filter(e => !reversedIds.has(String(e.id)))
}

/**
 * Reverses the active journal entries of an expense (asiento espejo con debe y
 * haber invertidos, misma fecha). Used when a confirmed expense goes back to
 * draft for correction: the original entry stays immutable and the reversal
 * nets it to zero.
 */
export async function reverseExpenseAccounting(
  expenseId: string,
  branchId: string | null,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  const actx = toAccountingContext(ctx)
  const entries = await findActiveExpenseInvoiceEntries(actx.orgId, expenseId, t)

  for (const entry of entries) {
    const lines = await JournalEntryLine.findAll({
      where: { entry_id: entry.id },
      attributes: ['account_id', 'debit', 'credit', 'description'],
      order: [['sort_order', 'ASC']],
      transaction: t,
    })
    await createPostedEntry({
      ctx: actx,
      sourceType: EXPENSE_INVOICE_REVERSAL_SOURCE,
      sourceId: String(entry.id),
      // Misma fecha que el asiento original: ambos netean a cero en el período.
      entryDate: new Date(`${String(entry.entry_date).slice(0, 10)}T12:00:00Z`),
      description: `Reversión asiento ${entry.entry_number} — corrección de gasto`,
      branchId,
      lines: buildReversalLines(lines.map(l => ({
        account_id: String(l.account_id),
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      }))),
    }, t)
  }
}

/**
 * Posts the journal entry for an expense once received: imputa el gasto a su
 * cuenta del plan de cuentas y la deuda con el proveedor.
 */
export async function postExpenseAccounting(
  expenseId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()
  const actx = toAccountingContext(ctx)

  // Skip only if there is a live (not reversed) entry: after a correction the
  // original entry stays reversed and a fresh one must be posted.
  const active = await findActiveExpenseInvoiceEntries(actx.orgId, expenseId, t)
  if (active.length > 0) return

  const expense = await Expense.findByPk(expenseId, { transaction: t })
  if (!expense || expense.status === 'draft' || expense.status === 'cancelled') return
  if (new Decimal(expense.total).lte(0)) return

  const items = await ExpenseItem.findAll({
    where: { expense_id: expenseId, org_id: actx.orgId, deleted_at: null },
    order: [['sort_order', 'ASC']],
    transaction: t,
  })
  const expenseCodes = items.length
    ? [...new Set(items.map(item => item.expense_account_code))]
    : [expense.expense_account_code]
  const requiredCodes = [
    ...expenseCodes,
    AUTO_POST_ACCOUNT_CODES.ivaCredit,
    AUTO_POST_ACCOUNT_CODES.payable,
  ]

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: [...requiredCodes] }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, requiredCodes)
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'expense_invoice',
      sourceId: expenseId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const { byCode } = resolved
  const ivaAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaCredit)!
  const payableAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.payable)!

  // The posted liability is the total minus the installments already settled
  // outside Andiko (prepaid cuotas with no payment row). Regular payments post
  // their own entries against proveedores, so they must NOT be netted here —
  // this keeps the entry correct when it is reposted after a correction.
  const fullTotal = new Decimal(expense.total)
  let orphanPrepaid = new Decimal(0)
  if (expense.kind === 'installment_plan') {
    const prepaid = await ExpenseInstallment.findAll({
      where: { expense_id: expenseId, status: 'paid', expense_payment_id: null, deleted_at: null },
      attributes: ['amount'],
      transaction: t,
    })
    orphanPrepaid = prepaid.reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
  }
  const unpaidTotal = Decimal.max(fullTotal.minus(orphanPrepaid), new Decimal(0))
  if (unpaidTotal.lte(0)) return

  const scale = fullTotal.gt(0) ? unpaidTotal.div(fullTotal) : new Decimal(1)
  const tax   = new Decimal(expense.tax_amount).mul(scale).toDecimalPlaces(2)
  const total = unpaidTotal.toDecimalPlaces(2)
  const neto  = deriveNetFromTotalAndTax(total, tax)

  const expenseLines: AutoPostLine[] = items.length
    ? items.map(item => ({
      account_id: byCode.get(item.expense_account_code)!.id,
      debit: new Decimal(item.subtotal).minus(item.discount_amount).mul(scale).toFixed(2),
      credit: '0.00',
      description: item.description,
    }))
    : [{
      account_id: byCode.get(expense.expense_account_code)!.id,
      debit: neto.toFixed(2),
      credit: '0.00',
      description: expense.description,
    }]

  // Keep the entry balanced if line rounding drifted.
  const expenseDebit = expenseLines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0))
  const taxDebit = tax.gt(0) ? tax : new Decimal(0)
  const payableCredit = expenseDebit.plus(taxDebit).toFixed(2)

  const lines: AutoPostLine[] = [
    ...expenseLines,
    ...(taxDebit.gt(0)
      ? [{ account_id: ivaAcc.id, debit: taxDebit.toFixed(2), credit: '0.00', description: 'IVA crédito fiscal' }]
      : []),
    { account_id: payableAcc.id, debit: '0.00', credit: payableCredit, description: `Gasto ${expense.expense_number}` },
  ]

  await createPostedEntry({
    ctx: actx,
    sourceType: 'expense_invoice',
    sourceId: expenseId,
    entryDate: expense.invoice_date ?? new Date(),
    description: `Gasto ${expense.expense_number} — ${expense.description}`,
    branchId: expense.branch_id,
    lines,
  }, t)
}
