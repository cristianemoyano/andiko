import 'server-only'
import { Op, QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import logger from '@/lib/logger'
import Account from './account.model'
import AccountingPeriod from './accounting-period.model'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import { createPostedEntry, resolveRequiredAccounts, toAccountingContext } from './accounting-auto-post.utils'
import { PERIOD_CLOSE_RESULT_ACCOUNT_CODE } from './accounting-period.constants'
import { buildClosingLines, buildReversalLines, type ClosingBalanceRow } from './period-close.utils'
import type { AccountingPeriodQuery, ClosePeriodInput } from './accounting-period.schema'

export type AccountingPeriodListItem = {
  id: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  created_at: Date
  closing_entry: { id: string; entry_number: string } | null
  reversal_entry: { id: string; entry_number: string } | null
}

/** Serializa cierres concurrentes por org (el chequeo de solapamiento no alcanza solo). */
async function acquirePeriodCloseLock(orgId: string, t: Transaction): Promise<void> {
  await sequelize.query(
    `SELECT pg_advisory_xact_lock(hashtext('accounting_period_close:' || :orgId))`,
    { replacements: { orgId }, type: QueryTypes.SELECT, transaction: t },
  )
}

async function getResultAccountBalances(
  orgId: string,
  from: string,
  to: string,
  t: Transaction,
): Promise<ClosingBalanceRow[]> {
  const rows = await sequelize.query<ClosingBalanceRow & { total_debit: string; total_credit: string }>(
    `SELECT a.id AS account_id, a.code, a.name, a.type::text AS type,
            COALESCE(SUM(l.debit), 0)  AS saldo_debit,
            COALESCE(SUM(l.credit), 0) AS saldo_credit
       FROM accounts a
       JOIN journal_entry_lines l ON l.account_id = a.id AND l.deleted_at IS NULL
       JOIN journal_entries e     ON e.id = l.entry_id   AND e.deleted_at IS NULL
      WHERE a.org_id = :orgId
        AND a.type IN ('income', 'expense')
        AND e.status = 'posted'
        AND e.entry_date >= :fromDate::date
        AND e.entry_date <= :toDate::date
      GROUP BY a.id, a.code, a.name, a.type
     HAVING COALESCE(SUM(l.debit), 0) <> COALESCE(SUM(l.credit), 0)
      ORDER BY a.code ASC`,
    {
      type: QueryTypes.SELECT,
      replacements: { orgId, fromDate: from, toDate: to },
      transaction: t,
    },
  )
  return rows
}

export async function closePeriod(input: ClosePeriodInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    await acquirePeriodCloseLock(ctx.orgId, t)

    const overlapping = await AccountingPeriod.findOne({
      where: {
        org_id: ctx.orgId,
        status: 'closed',
        start_date: { [Op.lte]: input.to },
        end_date: { [Op.gte]: input.from },
      },
      transaction: t,
    })
    if (overlapping) throw new Error('PERIOD_OVERLAP')

    const balances = await getResultAccountBalances(ctx.orgId, input.from, input.to, t)
    if (balances.length === 0) throw new Error('NOTHING_TO_CLOSE')

    const accounts = await Account.findAll({
      where: { org_id: ctx.orgId, code: PERIOD_CLOSE_RESULT_ACCOUNT_CODE },
      attributes: ['id', 'code', 'is_active', 'is_postable'],
      transaction: t,
    })
    const resolved = resolveRequiredAccounts(accounts, [PERIOD_CLOSE_RESULT_ACCOUNT_CODE])
    if (!resolved.ok) throw new Error('CLOSING_ACCOUNT_MISSING')
    const resultAccountId = String(resolved.byCode.get(PERIOD_CLOSE_RESULT_ACCOUNT_CODE)!.id)

    const lines = buildClosingLines(balances, resultAccountId)
    if (lines.length === 0) throw new Error('NOTHING_TO_CLOSE')

    const period = await AccountingPeriod.create(
      {
        org_id: ctx.orgId,
        start_date: input.from,
        end_date: input.to,
        status: 'closed',
        notes: input.notes ?? null,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    logger.info(
      { orgId: ctx.orgId, periodId: period.id, from: input.from, to: input.to, accountCount: balances.length, actorId },
      'accounting period close started',
    )

    const entry = await createPostedEntry(
      {
        ctx: toAccountingContext(ctx),
        sourceType: 'period_close',
        sourceId: period.id,
        entryDate: new Date(`${input.to}T12:00:00Z`),
        description: `Cierre de período ${input.from} a ${input.to}`,
        branchId: null,
        lines,
      },
      t,
    )

    await period.update({ closing_entry_id: entry.id }, { transaction: t })

    logger.info(
      { orgId: ctx.orgId, periodId: period.id, entryId: entry.id, entryNumber: entry.entry_number, actorId },
      'accounting period closed',
    )
    return period
  })
}

export async function reopenPeriod(id: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const period = await AccountingPeriod.findOne({
      where: { org_id: ctx.orgId, id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!period) throw new Error('PERIOD_NOT_FOUND')
    if (period.status !== 'closed') throw new Error('PERIOD_NOT_CLOSED')
    if (!period.closing_entry_id) throw new Error('PERIOD_NOT_CLOSED')

    const closingEntry = await JournalEntry.findOne({
      where: { org_id: ctx.orgId, id: period.closing_entry_id },
      transaction: t,
    })
    if (!closingEntry) throw new Error('PERIOD_NOT_CLOSED')

    const closingLines = await JournalEntryLine.findAll({
      where: { entry_id: closingEntry.id },
      attributes: ['account_id', 'debit', 'credit', 'description'],
      order: [['sort_order', 'ASC']],
      transaction: t,
    })

    const entry = await createPostedEntry(
      {
        ctx: toAccountingContext(ctx),
        sourceType: 'period_close_reversal',
        sourceId: period.id,
        // Misma fecha que el cierre: ambos asientos netean a cero dentro del período.
        entryDate: new Date(`${String(closingEntry.entry_date).slice(0, 10)}T12:00:00Z`),
        description: `Reapertura de período ${period.start_date} a ${period.end_date}`,
        branchId: null,
        lines: buildReversalLines(closingLines.map(l => ({
          account_id: String(l.account_id),
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        }))),
      },
      t,
    )

    await period.update({ status: 'reopened', reversal_entry_id: entry.id, updated_by: actorId }, { transaction: t })

    logger.info(
      { orgId: ctx.orgId, periodId: period.id, entryId: entry.id, actorId },
      'accounting period reopened',
    )
    return period
  })
}

export async function listPeriodCloses(query: AccountingPeriodQuery, ctx: TenantContext) {
  const { offset } = paginate(query.page, query.limit)
  const { rows, count } = await AccountingPeriod.findAndCountAll({
    where: { org_id: ctx.orgId },
    attributes: ['id', 'start_date', 'end_date', 'status', 'notes', 'closing_entry_id', 'reversal_entry_id', 'created_at'],
    order: [['end_date', 'DESC'], ['created_at', 'DESC']],
    limit: query.limit,
    offset,
  })

  const entryIds = [
    ...rows.map(p => p.closing_entry_id),
    ...rows.map(p => p.reversal_entry_id),
  ].filter((id): id is string => !!id)

  const entries = entryIds.length > 0
    ? await JournalEntry.findAll({
        where: { org_id: ctx.orgId, id: { [Op.in]: entryIds } },
        attributes: ['id', 'entry_number'],
      })
    : []
  const entryById = new Map(entries.map(e => [String(e.id), { id: String(e.id), entry_number: e.entry_number }]))

  const items: AccountingPeriodListItem[] = rows.map(period => ({
    id: String(period.id),
    start_date: String(period.start_date).slice(0, 10),
    end_date: String(period.end_date).slice(0, 10),
    status: period.status,
    notes: period.notes,
    created_at: period.created_at,
    closing_entry: period.closing_entry_id ? entryById.get(String(period.closing_entry_id)) ?? null : null,
    reversal_entry: period.reversal_entry_id ? entryById.get(String(period.reversal_entry_id)) ?? null : null,
  }))

  return toPaginated(items, count, query.page, query.limit)
}
