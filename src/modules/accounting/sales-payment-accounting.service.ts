import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber, resolveCashOrBankAccountId, CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import Payment from '@/modules/sales/payment.model'

const ACCOUNT_CODES = {
  receivable: '1.1.02.01',
  cash:       CASH_ACCOUNT_CODE,
  bank:       BANK_ACCOUNT_CODE,
} as const

/**
 * Posts the journal entry for a customer payment: ingresa a caja/banco y
 * cancela (total o parcialmente) la cuenta por cobrar.
 */
export async function postSalesPaymentAccounting(
  paymentId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'sales_payment', source_id: paymentId },
    transaction: t,
  })
  if (existing) return

  const payment = await Payment.findByPk(paymentId, { transaction: t })
  if (!payment) return
  const amount = new Decimal(payment.amount)
  if (amount.lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: Object.values(ACCOUNT_CODES) }),
    attributes: ['id', 'code'],
    transaction: t,
  })
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const recvAcc = byCode.get(ACCOUNT_CODES.receivable)
  const cashOrBankId = resolveCashOrBankAccountId(byCode, payment.payment_method)

  if (!recvAcc || !cashOrBankId) return

  const entry_number = await nextEntryNumber(ctx.orgId!, t)
  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   payment.payment_date ?? new Date(),
    description:  `Cobro ${payment.payment_number}`,
    status:       'posted',
    source_type:  'sales_payment',
    source_id:    paymentId,
    total_debit:  amount.toFixed(2),
    total_credit: amount.toFixed(2),
    created_by:   ctx.userId ?? null,
    updated_by:   ctx.userId ?? null,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    [
      { account_id: cashOrBankId, debit: amount.toFixed(2), credit: '0.00', description: 'Cobro de cliente' },
      { account_id: recvAcc.id,   debit: '0.00', credit: amount.toFixed(2), description: 'Cancelación cuenta por cobrar' },
    ].map((line, idx) => ({
      entry_id:    entry.id,
      account_id:  line.account_id,
      branch_id:   payment.branch_id,
      description: line.description,
      debit:       line.debit,
      credit:      line.credit,
      sort_order:  idx,
      created_by:  ctx.userId ?? null,
      updated_by:  ctx.userId ?? null,
    })),
    { transaction: t },
  )
}
