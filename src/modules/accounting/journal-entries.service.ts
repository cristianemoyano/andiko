import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import logger from '@/lib/logger'
import Branch from '@/modules/auth/branch.model'
import Account from './account.model'
import JournalEntry from './journal-entry.model'
import JournalEntryLine from './journal-entry-line.model'
import { ensureAccountingAssociations } from './accounting-associations'
import { nextEntryNumber } from './accounting.utils'
import type {
  JournalEntryInput,
  JournalEntryLineInput,
  JournalEntryUpdateInput,
  JournalEntryQuery,
} from './journal-entry.schema'

type PreparedLine = {
  account_id: string
  branch_id: string | null
  description: string | null
  debit: string
  credit: string
  sort_order: number
}

async function validateAndPrepareLines(
  lines: JournalEntryLineInput[],
  ctx: TenantContext,
  t: Transaction,
): Promise<{ prepared: PreparedLine[]; totalDebit: Decimal; totalCredit: Decimal }> {
  const accountIds = [...new Set(lines.map(l => l.account_id))]
  const accounts = await Account.findAll({
    where: whereOrg(ctx, { id: { [Op.in]: accountIds } }),
    attributes: ['id', 'is_postable', 'is_active'],
    transaction: t,
  })
  const accountMap = new Map(accounts.map(a => [String(a.id), a]))

  const branchIds = [...new Set(lines.map(l => l.branch_id).filter((b): b is string => !!b))]
  if (branchIds.length > 0) {
    const branches = await Branch.findAll({
      where: { id: { [Op.in]: branchIds }, org_id: ctx.orgId },
      attributes: ['id'],
      transaction: t,
    })
    const validBranchIds = new Set(branches.map(b => String(b.id)))
    for (const branchId of branchIds) {
      if (!validBranchIds.has(branchId)) throw new Error('BRANCH_NOT_FOUND')
      if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(branchId)) {
        throw new Error('BRANCH_NOT_ALLOWED')
      }
    }
  }

  let totalDebit = new Decimal(0)
  let totalCredit = new Decimal(0)
  const prepared: PreparedLine[] = lines.map((line, idx) => {
    const account = accountMap.get(line.account_id)
    if (!account) throw new Error('ACCOUNT_NOT_FOUND')
    if (!account.is_postable) throw new Error('ACCOUNT_NOT_POSTABLE')
    if (!account.is_active) throw new Error('ACCOUNT_INACTIVE')

    const debit = new Decimal(line.debit ?? 0)
    const credit = new Decimal(line.credit ?? 0)
    if (debit.gt(0) && credit.gt(0)) throw new Error('LINE_DEBIT_AND_CREDIT')
    if (debit.lte(0) && credit.lte(0)) throw new Error('LINE_EMPTY')

    totalDebit = totalDebit.plus(debit)
    totalCredit = totalCredit.plus(credit)

    return {
      account_id: line.account_id,
      branch_id: line.branch_id ?? null,
      description: line.description ?? null,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      sort_order: line.sort_order ?? idx,
    }
  })

  if (totalDebit.lte(0)) throw new Error('ENTRY_EMPTY')
  if (!totalDebit.equals(totalCredit)) throw new Error('ENTRY_NOT_BALANCED')

  return { prepared, totalDebit, totalCredit }
}

export async function listEntries(query: JournalEntryQuery, ctx: TenantContext) {
  const where: Record<string, unknown> = whereOrg(ctx)
  if (query.status) where.status = query.status
  if (query.from || query.to) {
    const range: Record<symbol, string> = {}
    if (query.from) range[Op.gte] = query.from
    if (query.to) range[Op.lte] = query.to
    where.entry_date = range
  }
  if (query.search) {
    const term = `%${query.search.trim()}%`
    where[Op.or as unknown as string] = [
      { entry_number: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ]
  }

  const { offset } = paginate(query.page, query.limit)
  const { rows, count } = await JournalEntry.findAndCountAll({
    where,
    attributes: ['id', 'entry_number', 'entry_date', 'description', 'status', 'total_debit', 'total_credit', 'created_at'],
    order: [['entry_date', 'DESC'], ['entry_number', 'DESC']],
    limit: query.limit,
    offset,
  })
  return toPaginated(rows, count, query.page, query.limit)
}

export async function getEntry(id: string, ctx: TenantContext) {
  ensureAccountingAssociations()
  const entry = await JournalEntry.findOne({
    where: whereOrg(ctx, { id }),
    include: [
      {
        model: JournalEntryLine,
        as: 'lines',
        attributes: ['id', 'account_id', 'branch_id', 'description', 'debit', 'credit', 'sort_order'],
        include: [
          { model: Account, as: 'account', attributes: ['id', 'code', 'name', 'type'] },
          { model: Branch, as: 'branch', attributes: ['id', 'branch_code', 'name'], required: false },
        ],
      },
    ],
    order: [[{ model: JournalEntryLine, as: 'lines' }, 'sort_order', 'ASC']],
  })
  if (!entry) throw new Error('ENTRY_NOT_FOUND')
  return entry
}

export async function createEntry(input: JournalEntryInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { prepared, totalDebit, totalCredit } = await validateAndPrepareLines(input.lines, ctx, t)
    const entry_number = await nextEntryNumber(ctx.orgId, t)

    const entry = await JournalEntry.create(
      {
        entry_number,
        entry_date: input.entry_date as unknown as Date,
        description: input.description ?? null,
        status: 'draft',
        total_debit: totalDebit.toFixed(2),
        total_credit: totalCredit.toFixed(2),
        org_id: ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    await JournalEntryLine.bulkCreate(
      prepared.map(line => ({
        ...line,
        entry_id: entry.id,
        org_id: ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )

    logger.info({ entryId: entry.id, entry_number, orgId: ctx.orgId, actorId }, 'journal entry created')
    return getEntryInTransaction(entry.id, ctx, t)
  })
}

async function getEntryInTransaction(id: string, ctx: TenantContext, t: Transaction) {
  ensureAccountingAssociations()
  return JournalEntry.findOne({
    where: whereOrg(ctx, { id }),
    include: [
      {
        model: JournalEntryLine,
        as: 'lines',
        attributes: ['id', 'account_id', 'branch_id', 'description', 'debit', 'credit', 'sort_order'],
        include: [
          { model: Account, as: 'account', attributes: ['id', 'code', 'name', 'type'] },
          { model: Branch, as: 'branch', attributes: ['id', 'branch_code', 'name'], required: false },
        ],
      },
    ],
    order: [[{ model: JournalEntryLine, as: 'lines' }, 'sort_order', 'ASC']],
    transaction: t,
  })
}

export async function updateEntry(
  id: string,
  input: JournalEntryUpdateInput,
  ctx: TenantContext,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const entry = await JournalEntry.findOne({ where: whereOrg(ctx, { id }), transaction: t, lock: t.LOCK.UPDATE })
    if (!entry) throw new Error('ENTRY_NOT_FOUND')
    if (entry.status !== 'draft') throw new Error('ENTRY_NOT_EDITABLE')

    const next: Record<string, unknown> = { updated_by: actorId }
    if (input.entry_date !== undefined) next.entry_date = input.entry_date
    if (input.description !== undefined) next.description = input.description

    if (input.lines !== undefined) {
      const { prepared, totalDebit, totalCredit } = await validateAndPrepareLines(input.lines, ctx, t)
      await JournalEntryLine.destroy({ where: { entry_id: id }, force: true, transaction: t })
      await JournalEntryLine.bulkCreate(
        prepared.map(line => ({
          ...line,
          entry_id: id,
          org_id: ctx.orgId,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
      next.total_debit = totalDebit.toFixed(2)
      next.total_credit = totalCredit.toFixed(2)
    }

    await entry.update(next, { transaction: t })
    logger.info({ entryId: id, orgId: ctx.orgId, actorId }, 'journal entry updated')
    return getEntryInTransaction(id, ctx, t)
  })
}

export async function postEntry(id: string, ctx: TenantContext, actorId: string) {
  const entry = await JournalEntry.findOne({ where: whereOrg(ctx, { id }) })
  if (!entry) throw new Error('ENTRY_NOT_FOUND')
  if (entry.status === 'posted') throw new Error('ENTRY_ALREADY_POSTED')
  if (!new Decimal(entry.total_debit).equals(new Decimal(entry.total_credit))) {
    throw new Error('ENTRY_NOT_BALANCED')
  }

  await entry.update({ status: 'posted', updated_by: actorId })
  logger.info({ entryId: id, orgId: ctx.orgId, actorId }, 'journal entry posted')
  return getEntry(id, ctx)
}

export async function deleteEntry(id: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const entry = await JournalEntry.findOne({ where: whereOrg(ctx, { id }), transaction: t, lock: t.LOCK.UPDATE })
    if (!entry) throw new Error('ENTRY_NOT_FOUND')
    if (entry.status !== 'draft') throw new Error('ENTRY_NOT_DELETABLE')

    await JournalEntryLine.destroy({ where: { entry_id: id }, transaction: t })
    await entry.update({ deleted_by: actorId }, { transaction: t })
    await entry.destroy({ transaction: t })
    logger.info({ entryId: id, orgId: ctx.orgId, actorId }, 'journal entry soft-deleted')
  })
}
