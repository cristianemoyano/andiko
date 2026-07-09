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
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import ProductVariant from '@/modules/catalog/product-variant.model'

const REQUIRED_CODES = [
  AUTO_POST_ACCOUNT_CODES.sales,
  AUTO_POST_ACCOUNT_CODES.ivaDebit,
  AUTO_POST_ACCOUNT_CODES.receivable,
] as const

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

export type PostInvoiceIssuedAccountingOptions = {
  invoice?: Invoice
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
  options: PostInvoiceIssuedAccountingOptions = {},
): Promise<void> {
  ensureAccountingAssociations()
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'sales_invoice', invoiceId, t)
  if (existing) return

  const invoice = options.invoice ?? await Invoice.findByPk(invoiceId, { transaction: t })
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return
  if (new Decimal(invoice.total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, {
      code: [
        ...REQUIRED_CODES,
        AUTO_POST_ACCOUNT_CODES.cogs,
        AUTO_POST_ACCOUNT_CODES.inventory,
      ],
    }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })

  const resolved = resolveRequiredAccounts(accounts, REQUIRED_CODES)
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'sales_invoice',
      sourceId: invoiceId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const { byCode } = resolved
  const salesAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.sales)!
  const ivaAcc   = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaDebit)!
  const recvAcc  = byCode.get(AUTO_POST_ACCOUNT_CODES.receivable)!

  const tax   = new Decimal(invoice.tax_amount)
  const total = new Decimal(invoice.total)
  const neto  = deriveNetFromTotalAndTax(total, tax)

  const lines: AutoPostLine[] = [
    { account_id: recvAcc.id,  debit: total.toFixed(2), credit: '0.00', description: `Venta ${invoice.invoice_number}` },
    { account_id: salesAcc.id, debit: '0.00', credit: neto.toFixed(2), description: 'Ventas' },
    { account_id: ivaAcc.id,   debit: '0.00', credit: tax.toFixed(2),  description: 'IVA débito fiscal' },
  ]

  const cogsAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.cogs)
  const invAcc  = byCode.get(AUTO_POST_ACCOUNT_CODES.inventory)
  if (cogsAcc && invAcc) {
    const cogsTotal = await calcCogsTotal(invoiceId, actx.orgId, t)
    if (cogsTotal.gt(0)) {
      lines.push(
        { account_id: cogsAcc.id, debit: cogsTotal.toFixed(2), credit: '0.00', description: 'Costo de mercadería vendida' },
        { account_id: invAcc.id,  debit: '0.00', credit: cogsTotal.toFixed(2), description: 'Salida de mercadería por venta' },
      )
    }
  }

  await createPostedEntry({
    ctx: actx,
    sourceType: 'sales_invoice',
    sourceId: invoiceId,
    entryDate: invoice.issue_date ?? new Date(),
    description: `Factura ${invoice.invoice_number}`,
    branchId: invoice.branch_id,
    lines,
  }, t)
}
