import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import {
  assertBalancedLines,
  auditUserId,
  nextEntryNumber,
  type AccountingContext,
} from './accounting.utils'
import { clampDateOutOfClosedPeriods } from './accounting-period-guards'

export type { AccountingContext } from './accounting.utils'
export {
  auditUserId,
  deriveNetFromTotalAndTax,
  assertBalancedLines,
  resolveRequiredAccounts,
  toAccountingContext,
} from './accounting.utils'

export type AutoPostLine = { account_id: string; debit: string; credit: string; description: string }

export function logAutoPostSkipped(params: {
  orgId: string
  sourceType: string
  sourceId: string
  missingCodes: string[]
}): void {
  logger.warn(params, 'accounting auto-post skipped')
}

export async function findExistingAutoPostEntry(
  orgId: string,
  sourceType: string,
  sourceId: string,
  t: Transaction,
): Promise<JournalEntry | null> {
  return JournalEntry.findOne({
    where: { org_id: orgId, source_type: sourceType, source_id: sourceId },
    transaction: t,
  })
}

export type CreatePostedEntryParams = {
  ctx: AccountingContext
  sourceType: string
  sourceId: string
  entryDate: Date
  description: string
  branchId: string | null
  lines: AutoPostLine[]
}

export async function createPostedEntry(
  params: CreatePostedEntryParams,
  t: Transaction,
): Promise<JournalEntry> {
  assertBalancedLines(params.lines)

  const totalDebit = params.lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const totalCredit = params.lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))
  const userId = auditUserId(params.ctx.userId)
  const entry_number = await nextEntryNumber(params.ctx.orgId, t)

  // El auto-posting nunca puede frenar la operación de negocio: si la fecha cae
  // en un período cerrado, se reimputa al primer día abierto (nunca falla).
  let entryDate: Date | string = params.entryDate
  let description = params.description
  if (params.sourceType !== 'period_close' && params.sourceType !== 'period_close_reversal') {
    const clamp = await clampDateOutOfClosedPeriods(params.ctx.orgId, params.entryDate, t)
    if (clamp.clamped) {
      entryDate = clamp.dateOnly
      description = `${description} (período cerrado: reimputado)`
      logger.warn(
        { orgId: params.ctx.orgId, sourceType: params.sourceType, sourceId: params.sourceId, originalDate: params.entryDate, entryDate },
        'accounting auto-post reimputed out of closed period',
      )
    }
  }

  const entry = await JournalEntry.create({
    org_id:       params.ctx.orgId,
    entry_number,
    entry_date:   entryDate as Date,
    description,
    status:       'posted',
    source_type:  params.sourceType,
    source_id:    params.sourceId,
    total_debit:  totalDebit.toFixed(2),
    total_credit: totalCredit.toFixed(2),
    created_by:   userId,
    updated_by:   userId,
  }, { transaction: t })

  await JournalEntryLine.bulkCreate(
    params.lines.map((line, idx) => ({
      entry_id:    entry.id,
      account_id:  line.account_id,
      branch_id:   params.branchId,
      description: line.description,
      debit:       line.debit,
      credit:      line.credit,
      sort_order:  idx,
      created_by:  userId,
      updated_by:  userId,
    })),
    { transaction: t },
  )

  return entry
}
