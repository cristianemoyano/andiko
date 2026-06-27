import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import SalesReturn from '@/modules/sales/sales-return.model'

const ACCOUNT_CODES = {
  sales:      '4.1.01',
  ivaDebit:   '2.1.02.01',
  receivable: '1.1.02.01',
  cash:       '1.1.01.01',
} as const

export async function postReturnAccounting(
  returnId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'sales_return', source_id: returnId },
    transaction: t,
  })
  if (existing) return

  const salesReturn = await SalesReturn.findByPk(returnId, { transaction: t })
  if (!salesReturn || salesReturn.status !== 'completed') return
  if (new Decimal(salesReturn.returned_total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: Object.values(ACCOUNT_CODES) }),
    attributes: ['id', 'code'],
    transaction: t,
  })
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const salesAcc = byCode.get(ACCOUNT_CODES.sales)
  const ivaAcc   = byCode.get(ACCOUNT_CODES.ivaDebit)
  const recvAcc  = byCode.get(ACCOUNT_CODES.receivable)
  const cashAcc  = byCode.get(ACCOUNT_CODES.cash)

  if (!salesAcc || !ivaAcc || !recvAcc) return

  const subtotal = new Decimal(salesReturn.returned_subtotal)
  const tax      = new Decimal(salesReturn.returned_tax)
  const total    = new Decimal(salesReturn.returned_total)
  const entry_number = await nextEntryNumber(ctx.orgId!, t)

  const creditAccountId = salesReturn.refund_disposition === 'cash_refund' && cashAcc
    ? cashAcc.id
    : recvAcc.id

  const lines = [
    { account_id: salesAcc.id, debit: subtotal.toFixed(2), credit: '0.00', description: 'Reverso ventas por devolución' },
    { account_id: ivaAcc.id,   debit: tax.toFixed(2),      credit: '0.00', description: 'Reverso IVA débito' },
    { account_id: creditAccountId, debit: '0.00', credit: total.toFixed(2), description: 'Devolución de venta' },
  ]

  const totalDebit  = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))

  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   salesReturn.completed_at ?? new Date(),
    description:  `Devolución ${salesReturn.return_number}`,
    status:       'posted',
    source_type:  'sales_return',
    source_id:    returnId,
    total_debit:  totalDebit.toFixed(2),
    total_credit: totalCredit.toFixed(2),
    created_by:   ctx.userId ?? null,
    updated_by:   ctx.userId ?? null,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    lines.map((line, idx) => ({
      entry_id:       entry.id,
      account_id:     line.account_id,
      branch_id:      salesReturn.branch_id,
      description:    line.description,
      debit:          line.debit,
      credit:         line.credit,
      sort_order:     idx,
      created_by:     ctx.userId ?? null,
      updated_by:     ctx.userId ?? null,
    })),
    { transaction: t },
  )
}
