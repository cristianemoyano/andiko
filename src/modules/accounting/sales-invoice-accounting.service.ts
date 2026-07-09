import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import Account from './account.model'
import { nextEntryNumber } from './accounting.utils'
import { ensureAccountingAssociations } from './accounting-associations'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'

const ACCOUNT_CODES = {
  sales:      '4.1.01',
  ivaDebit:   '2.1.02.01',
  receivable: '1.1.02.01',
  cogs:       '5.1.01',
  inventory:  '1.1.03.01',
} as const

type Line = { account_id: string; debit: string; credit: string; description: string }

async function calcCogsTotal(invoiceId: string, orgId: string, t: Transaction): Promise<Decimal> {
  const items = await InvoiceItem.findAll({
    where: { invoice_id: invoiceId },
    attributes: ['quantity', 'variant_id'],
    transaction: t,
  })

  const variantIds = [...new Set(items.map(i => i.variant_id).filter((v): v is string => !!v))]
  if (variantIds.length === 0) return new Decimal(0)

  const variants = await ProductVariant.findAll({
    where: { id: variantIds, org_id: orgId },
    attributes: ['id', 'cost_price'],
    transaction: t,
  })
  const costByVariant = new Map(variants.map(v => [v.id, v.cost_price]))

  return items.reduce((acc, item) => {
    const cost = item.variant_id ? costByVariant.get(item.variant_id) : null
    return cost ? acc.plus(new Decimal(item.quantity).mul(cost)) : acc
  }, new Decimal(0))
}

/**
 * Posts the journal entry for a sales invoice once issued: reconoce la venta,
 * el IVA débito fiscal, y la cuenta por cobrar. Si hay costo disponible en las
 * variantes vendidas, también imputa el costo de mercadería vendida.
 */
export async function postInvoiceIssuedAccounting(
  invoiceId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()

  const existing = await JournalEntry.findOne({
    where: { org_id: ctx.orgId, source_type: 'sales_invoice', source_id: invoiceId },
    transaction: t,
  })
  if (existing) return

  const invoice = await Invoice.findByPk(invoiceId, { transaction: t })
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return
  if (new Decimal(invoice.total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: Object.values(ACCOUNT_CODES) }),
    attributes: ['id', 'code'],
    transaction: t,
  })
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const salesAcc = byCode.get(ACCOUNT_CODES.sales)
  const ivaAcc   = byCode.get(ACCOUNT_CODES.ivaDebit)
  const recvAcc  = byCode.get(ACCOUNT_CODES.receivable)

  if (!salesAcc || !ivaAcc || !recvAcc) return

  const neto  = new Decimal(invoice.subtotal).minus(invoice.discount_amount)
  const tax   = new Decimal(invoice.tax_amount)
  const total = new Decimal(invoice.total)

  const lines: Line[] = [
    { account_id: recvAcc.id,  debit: total.toFixed(2), credit: '0.00', description: `Venta ${invoice.invoice_number}` },
    { account_id: salesAcc.id, debit: '0.00', credit: neto.toFixed(2), description: 'Ventas' },
    { account_id: ivaAcc.id,   debit: '0.00', credit: tax.toFixed(2),  description: 'IVA débito fiscal' },
  ]

  const cogsAcc = byCode.get(ACCOUNT_CODES.cogs)
  const invAcc  = byCode.get(ACCOUNT_CODES.inventory)
  if (cogsAcc && invAcc) {
    const cogsTotal = await calcCogsTotal(invoiceId, ctx.orgId, t)
    if (cogsTotal.gt(0)) {
      lines.push(
        { account_id: cogsAcc.id, debit: cogsTotal.toFixed(2), credit: '0.00', description: 'Costo de mercadería vendida' },
        { account_id: invAcc.id,  debit: '0.00', credit: cogsTotal.toFixed(2), description: 'Salida de mercadería por venta' },
      )
    }
  }

  const totalDebit  = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))

  const entry_number = await nextEntryNumber(ctx.orgId!, t)
  const entry = await JournalEntry.create({
    org_id:       ctx.orgId,
    entry_number,
    entry_date:   invoice.issue_date ?? new Date(),
    description:  `Factura ${invoice.invoice_number}`,
    status:       'posted',
    source_type:  'sales_invoice',
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
