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
  findExistingAutoPostEntry,
  logAutoPostSkipped,
  resolveRequiredAccounts,
  toAccountingContext,
  type AutoPostLine,
} from './accounting-auto-post.utils'
import Expense from '@/modules/expenses/expense.model'

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

  const existing = await findExistingAutoPostEntry(actx.orgId, 'expense_invoice', expenseId, t)
  if (existing) return

  const expense = await Expense.findByPk(expenseId, { transaction: t })
  if (!expense || expense.status === 'draft' || expense.status === 'cancelled') return
  if (new Decimal(expense.total).lte(0)) return

  const requiredCodes = [expense.expense_account_code, AUTO_POST_ACCOUNT_CODES.ivaCredit, AUTO_POST_ACCOUNT_CODES.payable] as const

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
  const expenseAcc = byCode.get(expense.expense_account_code)!
  const ivaAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaCredit)!
  const payableAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.payable)!

  const tax   = new Decimal(expense.tax_amount)
  const total = new Decimal(expense.total)
  const neto  = deriveNetFromTotalAndTax(total, tax)

  const lines: AutoPostLine[] = [
    { account_id: expenseAcc.id, debit: neto.toFixed(2), credit: '0.00', description: expense.description },
    { account_id: ivaAcc.id,     debit: tax.toFixed(2),  credit: '0.00', description: 'IVA crédito fiscal' },
    { account_id: payableAcc.id, debit: '0.00', credit: total.toFixed(2), description: `Gasto ${expense.expense_number}` },
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
