import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import PurchaseReturn from '@/modules/purchases/purchase-return.model'

const ACCOUNT_CODES = {
  inventory: '1.1.03.01', // Mercaderías
  ivaCredit: '1.1.02.02', // IVA Crédito Fiscal
  payable:   '2.1.01.01', // Proveedores
} as const

type Line = { account_id: string; debit: string; credit: string; description: string }

/**
 * Posts the journal entry for a completed purchase return (devolución a
 * proveedor). The return reverses the original purchase for the returned goods
 * — reducing inventory, IVA crédito and the payable. For an exchange, the
 * replacement goods are booked as a fresh purchase in the same entry.
 */
export async function postPurchaseReturnAccounting(
  returnId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'purchase_return', source_id: returnId },
    transaction: t,
  })
  if (existing) return

  const purchaseReturn = await PurchaseReturn.findByPk(returnId, { transaction: t })
  if (!purchaseReturn || purchaseReturn.status !== 'completed') return
  if (new Decimal(purchaseReturn.returned_total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: Object.values(ACCOUNT_CODES) }),
    attributes: ['id', 'code'],
    transaction: t,
  })
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const invAcc     = byCode.get(ACCOUNT_CODES.inventory)
  const ivaAcc     = byCode.get(ACCOUNT_CODES.ivaCredit)
  const payableAcc = byCode.get(ACCOUNT_CODES.payable)

  if (!invAcc || !ivaAcc || !payableAcc) return

  const returnedNeto = new Decimal(purchaseReturn.returned_subtotal).minus(purchaseReturn.returned_discount)
  const returnedTax  = new Decimal(purchaseReturn.returned_tax)
  const returnedTot  = new Decimal(purchaseReturn.returned_total)

  const lines: Line[] = [
    { account_id: payableAcc.id, debit: returnedTot.toFixed(2),  credit: '0.00', description: 'Reverso deuda proveedor por devolución' },
    { account_id: invAcc.id,     debit: '0.00', credit: returnedNeto.toFixed(2), description: 'Reverso mercaderías por devolución' },
    { account_id: ivaAcc.id,     debit: '0.00', credit: returnedTax.toFixed(2),  description: 'Reverso IVA crédito fiscal' },
  ]

  // Exchange: the replacement goods are a new purchase against the supplier.
  const exchangeTot = new Decimal(purchaseReturn.exchange_total)
  if (exchangeTot.gt(0)) {
    const exchangeNeto = new Decimal(purchaseReturn.exchange_subtotal).minus(purchaseReturn.exchange_discount)
    const exchangeTax  = new Decimal(purchaseReturn.exchange_tax)
    lines.push(
      { account_id: invAcc.id,     debit: exchangeNeto.toFixed(2), credit: '0.00', description: 'Mercaderías por cambio' },
      { account_id: ivaAcc.id,     debit: exchangeTax.toFixed(2),  credit: '0.00', description: 'IVA crédito fiscal por cambio' },
      { account_id: payableAcc.id, debit: '0.00', credit: exchangeTot.toFixed(2),  description: 'Deuda proveedor por cambio' },
    )
  }

  const totalDebit  = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))

  const entry_number = await nextEntryNumber(ctx.orgId!, t)
  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   purchaseReturn.completed_at ?? new Date(),
    description:  `Devolución a proveedor ${purchaseReturn.return_number}`,
    status:       'posted',
    source_type:  'purchase_return',
    source_id:    returnId,
    total_debit:  totalDebit.toFixed(2),
    total_credit: totalCredit.toFixed(2),
    created_by:   ctx.userId ?? null,
    updated_by:   ctx.userId ?? null,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    lines.map((line, idx) => ({
      entry_id:    entry.id,
      account_id:  line.account_id,
      branch_id:   purchaseReturn.branch_id,
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
