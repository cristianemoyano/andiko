import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber, resolveCashOrBankAccountId, CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import SupplierPayment from '@/modules/purchases/supplier-payment.model'

const ACCOUNT_CODES = {
  payable: '2.1.01.01',
  cash:    CASH_ACCOUNT_CODE,
  bank:    BANK_ACCOUNT_CODE,
} as const

/**
 * Posts the journal entry for a supplier payment: sale de caja/banco y
 * cancela (total o parcialmente) la deuda con el proveedor.
 */
export async function postSupplierPaymentAccounting(
  paymentId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'purchase_payment', source_id: paymentId },
    transaction: t,
  })
  if (existing) return

  const payment = await SupplierPayment.findByPk(paymentId, { transaction: t })
  if (!payment) return
  const amount = new Decimal(payment.amount)
  if (amount.lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: Object.values(ACCOUNT_CODES) }),
    attributes: ['id', 'code'],
    transaction: t,
  })
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const payableAcc = byCode.get(ACCOUNT_CODES.payable)
  const cashOrBankId = resolveCashOrBankAccountId(byCode, payment.payment_method)

  if (!payableAcc || !cashOrBankId) return

  const entry_number = await nextEntryNumber(ctx.orgId!, t)
  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   payment.payment_date ?? new Date(),
    description:  `Pago a proveedor ${payment.payment_number}`,
    status:       'posted',
    source_type:  'purchase_payment',
    source_id:    paymentId,
    total_debit:  amount.toFixed(2),
    total_credit: amount.toFixed(2),
    created_by:   ctx.userId ?? null,
    updated_by:   ctx.userId ?? null,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    [
      { account_id: payableAcc.id, debit: amount.toFixed(2), credit: '0.00', description: 'Cancelación deuda proveedor' },
      { account_id: cashOrBankId,  debit: '0.00', credit: amount.toFixed(2), description: 'Pago a proveedor' },
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
