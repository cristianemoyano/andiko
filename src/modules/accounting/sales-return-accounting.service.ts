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
import SalesReturn from '@/modules/sales/sales-return.model'

const REQUIRED_CODES = [
  AUTO_POST_ACCOUNT_CODES.sales,
  AUTO_POST_ACCOUNT_CODES.ivaDebit,
  AUTO_POST_ACCOUNT_CODES.receivable,
] as const

export async function postReturnAccounting(
  returnId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  ensureAccountingAssociations()
  const actx = toAccountingContext(ctx)

  const existing = await findExistingAutoPostEntry(actx.orgId, 'sales_return', returnId, t)
  if (existing) return

  const salesReturn = await SalesReturn.findByPk(returnId, { transaction: t })
  if (!salesReturn || salesReturn.status !== 'completed') return
  if (new Decimal(salesReturn.returned_total).lte(0)) return

  const accounts = await Account.findAll({
    where: whereOrg(ctx, {
      code: [...REQUIRED_CODES, AUTO_POST_ACCOUNT_CODES.cash],
    }),
    attributes: ['id', 'code', 'is_active', 'is_postable'],
    transaction: t,
  })
  const resolved = resolveRequiredAccounts(accounts, REQUIRED_CODES)
  if (!resolved.ok) {
    logAutoPostSkipped({
      orgId: actx.orgId,
      sourceType: 'sales_return',
      sourceId: returnId,
      missingCodes: resolved.missingCodes,
    })
    return
  }

  const { byCode } = resolved
  const salesAcc = byCode.get(AUTO_POST_ACCOUNT_CODES.sales)!
  const ivaAcc   = byCode.get(AUTO_POST_ACCOUNT_CODES.ivaDebit)!
  const recvAcc  = byCode.get(AUTO_POST_ACCOUNT_CODES.receivable)!
  const cashAcc  = byCode.get(AUTO_POST_ACCOUNT_CODES.cash)

  const tax   = new Decimal(salesReturn.returned_tax)
  const total = new Decimal(salesReturn.returned_total)
  const neto  = deriveNetFromTotalAndTax(total, tax)

  const creditAccountId = salesReturn.refund_disposition === 'cash_refund' && cashAcc
    ? cashAcc.id
    : recvAcc.id

  const lines: AutoPostLine[] = [
    { account_id: salesAcc.id, debit: neto.toFixed(2), credit: '0.00', description: 'Reverso ventas por devolución' },
    { account_id: ivaAcc.id,   debit: tax.toFixed(2),  credit: '0.00', description: 'Reverso IVA débito' },
    { account_id: creditAccountId, debit: '0.00', credit: total.toFixed(2), description: 'Devolución de venta' },
  ]

  await createPostedEntry({
    ctx: actx,
    sourceType: 'sales_return',
    sourceId: returnId,
    entryDate: salesReturn.completed_at ?? new Date(),
    description: `Devolución ${salesReturn.return_number}`,
    branchId: salesReturn.branch_id,
    lines,
  }, t)
}
