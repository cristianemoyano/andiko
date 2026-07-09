import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'

const ACCOUNT_CODES = {
  inventory: '1.1.03.01',
  ivaCredit: '1.1.02.02',
  payable:   '2.1.01.01',
} as const

type Line = { account_id: string; debit: string; credit: string; description: string }

/**
 * Posts the journal entry for a supplier invoice once received: ingresa la
 * mercadería, el IVA crédito fiscal, y la deuda con el proveedor.
 */
export async function postSupplierInvoiceAccounting(
  invoiceId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'purchase_invoice', source_id: invoiceId },
    transaction: t,
  })
  if (existing) return

  const invoice = await SupplierInvoice.findByPk(invoiceId, { transaction: t })
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return
  if (new Decimal(invoice.total).lte(0)) return

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

  const neto  = new Decimal(invoice.subtotal).minus(invoice.discount_amount)
  const tax   = new Decimal(invoice.tax_amount)
  const total = new Decimal(invoice.total)

  const lines: Line[] = [
    { account_id: invAcc.id,     debit: neto.toFixed(2), credit: '0.00', description: 'Mercaderías' },
    { account_id: ivaAcc.id,     debit: tax.toFixed(2),  credit: '0.00', description: 'IVA crédito fiscal' },
    { account_id: payableAcc.id, debit: '0.00', credit: total.toFixed(2), description: `Factura proveedor ${invoice.invoice_number}` },
  ]

  const totalDebit  = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))

  const entry_number = await nextEntryNumber(ctx.orgId!, t)
  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   invoice.invoice_date ?? new Date(),
    description:  `Factura de compra ${invoice.invoice_number}`,
    status:       'posted',
    source_type:  'purchase_invoice',
    source_id:    invoiceId,
    total_debit:  totalDebit.toFixed(2),
    total_credit: totalCredit.toFixed(2),
    created_by:   ctx.userId ?? null,
    updated_by:   ctx.userId ?? null,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    lines.map((line, idx) => ({
      entry_id:    entry.id,
      account_id:  line.account_id,
      branch_id:   invoice.branch_id,
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
