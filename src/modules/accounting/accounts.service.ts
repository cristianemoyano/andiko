import 'server-only'
import { Op, UniqueConstraintError } from 'sequelize'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import logger from '@/lib/logger'
import Account from './account.model'
import JournalEntryLine from './journal-entry-line.model'
import { seedDefaultChartOfAccounts } from './chart-seed'
import type { AccountInput, AccountUpdateInput, AccountQuery } from './account.schema'

export { seedDefaultChartOfAccounts }

const LIST_ATTRS = ['id', 'org_id', 'parent_id', 'code', 'name', 'type', 'is_postable', 'is_active', 'is_system'] as const

export async function listAccounts(query: AccountQuery, ctx: TenantContext) {
  const where: Record<string, unknown> = whereOrg(ctx)
  if (query.type) where.type = query.type
  if (query.is_postable !== undefined) where.is_postable = query.is_postable
  if (query.is_active !== undefined) where.is_active = query.is_active
  if (query.search) {
    const term = `%${query.search.trim()}%`
    where[Op.or as unknown as string] = [
      { code: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
    ]
  }

  if (query.all) {
    const rows = await Account.findAll({
      where,
      attributes: [...LIST_ATTRS],
      order: [['code', 'ASC']],
    })
    return toPaginated(rows, rows.length, 1, rows.length || 1)
  }

  const { offset } = paginate(query.page, query.limit)
  const { rows, count } = await Account.findAndCountAll({
    where,
    attributes: [...LIST_ATTRS],
    order: [['code', 'ASC']],
    limit: query.limit,
    offset,
  })
  return toPaginated(rows, count, query.page, query.limit)
}

export async function getAccount(id: string, ctx: TenantContext) {
  const account = await Account.findOne({
    where: whereOrg(ctx, { id }),
    attributes: [...LIST_ATTRS],
  })
  if (!account) throw new Error('ACCOUNT_NOT_FOUND')
  return account
}

async function assertParentValid(parentId: string | null | undefined, ctx: TenantContext) {
  if (!parentId) return
  const parent = await Account.findOne({ where: whereOrg(ctx, { id: parentId }), attributes: ['id'] })
  if (!parent) throw new Error('PARENT_NOT_FOUND')
}

export async function createAccount(input: AccountInput, ctx: TenantContext, actorId: string) {
  await assertParentValid(input.parent_id ?? null, ctx)
  try {
    const account = await Account.create({
      code:        input.code,
      name:        input.name,
      type:        input.type,
      parent_id:   input.parent_id ?? null,
      is_postable: input.is_postable,
      is_active:   input.is_active,
      org_id:      ctx.orgId,
      created_by:  actorId,
      updated_by:  actorId,
    })
    logger.info({ accountId: account.id, orgId: ctx.orgId, actorId }, 'account created')
    return account
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw new Error('DUPLICATE_CODE')
    throw err
  }
}

export async function updateAccount(id: string, input: AccountUpdateInput, ctx: TenantContext, actorId: string) {
  const account = await getAccount(id, ctx)
  if (account.is_system && input.is_active === false) {
    throw new Error('SYSTEM_ACCOUNT_NOT_DEACTIVATABLE')
  }
  if (input.parent_id !== undefined) {
    if (input.parent_id === id) throw new Error('PARENT_CYCLE')
    await assertParentValid(input.parent_id, ctx)
  }

  const next: Partial<AccountInput> & { updated_by: string } = { updated_by: actorId }
  if (input.code !== undefined) next.code = input.code
  if (input.name !== undefined) next.name = input.name
  if (input.type !== undefined) next.type = input.type
  if (input.parent_id !== undefined) next.parent_id = input.parent_id
  if (input.is_postable !== undefined) next.is_postable = input.is_postable
  if (input.is_active !== undefined) next.is_active = input.is_active

  try {
    await account.update(next)
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw new Error('DUPLICATE_CODE')
    throw err
  }
  logger.info({ accountId: id, orgId: ctx.orgId, actorId }, 'account updated')
  return account.reload()
}

export async function deleteAccount(id: string, ctx: TenantContext, actorId: string) {
  const account = await getAccount(id, ctx)
  if (account.is_system) throw new Error('SYSTEM_ACCOUNT_NOT_DELETABLE')

  const lineCount = await JournalEntryLine.count({ where: { account_id: id } })
  if (lineCount > 0) throw new Error('ACCOUNT_HAS_MOVEMENTS')

  const childCount = await Account.count({ where: whereOrg(ctx, { parent_id: id }) })
  if (childCount > 0) throw new Error('ACCOUNT_HAS_CHILDREN')

  await account.update({ deleted_by: actorId })
  await account.destroy()
  logger.info({ accountId: id, orgId: ctx.orgId, actorId }, 'account soft-deleted')
}
