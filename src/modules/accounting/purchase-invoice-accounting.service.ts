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
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'

const REQUIRED_CODES = [
  AUTO_POST_ACCOUNT_CODES.inventory,
  AUTO_POST_ACCOUNT_CODES.ivaCredit,
  AUTO_POST_ACCOUNT_CODES.payable,
] as const

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
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'purchase_invoice', invoiceId, t)
  if (existing) return

  const invoice = await SupplierInvoice.findByPk(invoiceId, { transaction: t })
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return
  if (new Decimal(invoice.total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: [...REQUIRED_CODES] }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, REQUIRED_CODES)
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'purchase_invoice',
      sourceId: invoiceId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const { byCode } = resolved
  const invAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.inventory)!
  const ivaAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaCredit)!
  const payableAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.payable)!

  const tax   = new Decimal(invoice.tax_amount)
  const total = new Decimal(invoice.total)
  const neto  = deriveNetFromTotalAndTax(total, tax)

  const lines: AutoPostLine[] = [
    { account_id: invAcc.id,     debit: neto.toFixed(2), credit: '0.00', description: 'Mercaderías' },
    { account_id: ivaAcc.id,     debit: tax.toFixed(2),  credit: '0.00', description: 'IVA crédito fiscal' },
    { account_id: payableAcc.id, debit: '0.00', credit: total.toFixed(2), description: `Factura proveedor ${invoice.invoice_number}` },
  ]

  await createPostedEntry({
    ctx: actx,
    sourceType: 'purchase_invoice',
    sourceId: invoiceId,
    entryDate: invoice.invoice_date ?? new Date(),
    description: `Factura de compra ${invoice.invoice_number}`,
    branchId: invoice.branch_id,
    lines,
  }, t)
}
