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
import PurchaseReturn from '@/modules/purchases/purchase-return.model'

const REQUIRED_CODES = [
  AUTO_POST_ACCOUNT_CODES.inventory,
  AUTO_POST_ACCOUNT_CODES.ivaCredit,
  AUTO_POST_ACCOUNT_CODES.payable,
] as const

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
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'purchase_return', returnId, t)
  if (existing) return

  const purchaseReturn = await PurchaseReturn.findByPk(returnId, { transaction: t })
  if (!purchaseReturn || purchaseReturn.status !== 'completed') return
  if (new Decimal(purchaseReturn.returned_total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, { code: [...REQUIRED_CODES] }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, REQUIRED_CODES)
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'purchase_return',
      sourceId: returnId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const { byCode } = resolved
  const invAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.inventory)!
  const ivaAcc     = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaCredit)!
  const payableAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.payable)!

  const returnedTax  = new Decimal(purchaseReturn.returned_tax)
  const returnedTot  = new Decimal(purchaseReturn.returned_total)
  const returnedNeto = deriveNetFromTotalAndTax(returnedTot, returnedTax)

  const lines: AutoPostLine[] = [
    { account_id: payableAcc.id, debit: returnedTot.toFixed(2),  credit: '0.00', description: 'Reverso deuda proveedor por devolución' },
    { account_id: invAcc.id,     debit: '0.00', credit: returnedNeto.toFixed(2), description: 'Reverso mercaderías por devolución' },
    { account_id: ivaAcc.id,     debit: '0.00', credit: returnedTax.toFixed(2),  description: 'Reverso IVA crédito fiscal' },
  ]

  const exchangeTot = new Decimal(purchaseReturn.exchange_total)
  if (exchangeTot.gt(0)) {
    const exchangeTax  = new Decimal(purchaseReturn.exchange_tax)
    const exchangeNeto = deriveNetFromTotalAndTax(exchangeTot, exchangeTax)
    lines.push(
      { account_id: invAcc.id,     debit: exchangeNeto.toFixed(2), credit: '0.00', description: 'Mercaderías por cambio' },
      { account_id: ivaAcc.id,     debit: exchangeTax.toFixed(2),  credit: '0.00', description: 'IVA crédito fiscal por cambio' },
      { account_id: payableAcc.id, debit: '0.00', credit: exchangeTot.toFixed(2),  description: 'Deuda proveedor por cambio' },
    )
  }

  await createPostedEntry({
    ctx: actx,
    sourceType: 'purchase_return',
    sourceId: returnId,
    entryDate: purchaseReturn.completed_at ?? new Date(),
    description: `Devolución a proveedor ${purchaseReturn.return_number}`,
    branchId: purchaseReturn.branch_id,
    lines,
  }, t)
}
