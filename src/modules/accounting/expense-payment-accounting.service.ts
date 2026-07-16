import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import Account from './account.model'
import { resolveCashOrBankAccountId, CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import { AUTO_POST_ACCOUNT_CODES } from './default-chart'
import {
  createPostedEntry,
  findExistingAutoPostEntry,
  logAutoPostSkipped,
  resolveRequiredAccounts,
  toAccountingContext,
} from './accounting-auto-post.utils'
import ExpensePayment from '@/modules/expenses/expense-payment.model'

/**
 * Posts the journal entry for an expense payment: sale de caja/banco y
 * cancela (total o parcialmente) la deuda con el proveedor.
 */
export async function postExpensePaymentAccounting(
  paymentId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'expense_payment', paymentId, t)
  if (existing) return

  const payment = await ExpensePayment.findByPk(paymentId, { transaction: t })
  if (!payment) return
  const amount = new Decimal(payment.amount)
  if (amount.lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, {
      code: [AUTO_POST_ACCOUNT_CODES.payable, CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE],
    }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, [AUTO_POST_ACCOUNT_CODES.payable])
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'expense_payment',
      sourceId: paymentId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const payableAcc = resolved.byCode.get(AUTO_POST_ACCOUNT_CODES.payable)!
  const cashOrBankId = resolveCashOrBankAccountId(resolved.byCode, payment.payment_method)
  if (!cashOrBankId) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'expense_payment',
      sourceId: paymentId,
      missingCodes: [payment.payment_method === 'cash' ? CASH_ACCOUNT_CODE : BANK_ACCOUNT_CODE],
    })
    return
  }

  await createPostedEntry({
    ctx: actx,
    sourceType: 'expense_payment',
    sourceId: paymentId,
    entryDate: payment.payment_date ?? new Date(),
    description: `Pago de gasto ${payment.payment_number}`,
    branchId: payment.branch_id,
    lines: [
      { account_id: payableAcc.id, debit: amount.toFixed(2), credit: '0.00', description: 'Cancelación deuda proveedor' },
      { account_id: cashOrBankId,  debit: '0.00', credit: amount.toFixed(2), description: 'Pago de gasto' },
    ],
  }, t)
}
