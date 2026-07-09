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
import Payment from '@/modules/sales/payment.model'

const REQUIRED_CODES = [
  AUTO_POST_ACCOUNT_CODES.receivable,
  CASH_ACCOUNT_CODE,
  BANK_ACCOUNT_CODE,
] as const

export type PostSalesPaymentAccountingOptions = {
  payment?: Payment
}

/**
 * Posts the journal entry for a customer payment: ingresa a caja/banco y
 * cancela (total o parcialmente) la cuenta por cobrar.
 */
export async function postSalesPaymentAccounting(
  paymentId: string,
  ctx: TenantContext,
  t: Transaction,
  options: PostSalesPaymentAccountingOptions = {},
): Promise<void> {
  ensureAccountingAssociations()
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'sales_payment', paymentId, t)
  if (existing) return

  const payment = options.payment ?? await Payment.findByPk(paymentId, { transaction: t })
  if (!payment) return
  const amount = new Decimal(payment.amount)
  if (amount.lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: [...REQUIRED_CODES] }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, [AUTO_POST_ACCOUNT_CODES.receivable])
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'sales_payment',
      sourceId: paymentId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const recvAcc = resolved.byCode.get(AUTO_POST_ACCOUNT_CODES.receivable)!
  const cashOrBankId = resolveCashOrBankAccountId(resolved.byCode, payment.payment_method)
  if (!cashOrBankId) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'sales_payment',
      sourceId: paymentId,
      missingCodes: [payment.payment_method === 'cash' ? CASH_ACCOUNT_CODE : BANK_ACCOUNT_CODE],
    })
    return
  }

  await createPostedEntry({
    ctx: actx,
    sourceType: 'sales_payment',
    sourceId: paymentId,
    entryDate: payment.payment_date ?? new Date(),
    description: `Cobro ${payment.payment_number}`,
    branchId: payment.branch_id,
    lines: [
      { account_id: cashOrBankId, debit: amount.toFixed(2), credit: '0.00', description: 'Cobro de cliente' },
      { account_id: recvAcc.id,   debit: '0.00', credit: amount.toFixed(2), description: 'Cancelación cuenta por cobrar' },
    ],
  }, t)
}
