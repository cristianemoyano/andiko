import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import type { TenantContext } from '@/lib/tenancy'
import { assertFullLogisticsAccess } from './logistics-scope'
import CarrierAccount from './carrier-account.model'
import type { CarrierAccountInput, CarrierAccountUpdateInput, CarrierAccountQuery } from './carrier-account.schema'

const LIST_ATTRIBUTES = ['id', 'branch_id', 'kind', 'name', 'is_active', 'settings', 'created_at', 'updated_at'] as const

export async function listCarrierAccounts(query: CarrierAccountQuery, ctx: TenantContext) {
  const { page, limit, kind, branch_id, is_active, search } = query
  const { offset } = paginate(page, limit)

  const { rows, count } = await CarrierAccount.findAndCountAll({
    where: {
      org_id: ctx.orgId,
      ...(kind ? { kind } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      // Cuentas de la sucursal indicada + cuentas globales (branch_id null).
      ...(branch_id ? { [Op.or]: [{ branch_id }, { branch_id: null }] } : {}),
      ...(search ? { name: { [Op.iLike]: `%${search}%` } } : {}),
    },
    // Nunca exponer credentials_encrypted en listados/detalle.
    attributes: [...LIST_ATTRIBUTES],
    limit,
    offset,
    order: [['name', 'ASC']],
  })

  return toPaginated(rows.map(r => r.get({ plain: true })), count, page, limit)
}

export async function getCarrierAccount(id: string, ctx: TenantContext) {
  const account = await CarrierAccount.findOne({
    where: { id, org_id: ctx.orgId },
    attributes: [...LIST_ATTRIBUTES],
  })
  if (!account) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')
  return account.get({ plain: true })
}

export async function createCarrierAccount(input: CarrierAccountInput, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const { credentials, ...fields } = input
  const account = await CarrierAccount.create({
    ...fields,
    credentials_encrypted: credentials ? encryptSecret(JSON.stringify(credentials)) : null,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ carrierAccountId: account.id, kind: account.kind, orgId: ctx.orgId, actorId }, 'carrier account created')
  return getCarrierAccount(account.id, ctx)
}

export async function updateCarrierAccount(id: string, input: CarrierAccountUpdateInput, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const account = await CarrierAccount.findOne({ where: { id, org_id: ctx.orgId } })
  if (!account) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')

  const { credentials, ...fields } = input
  await account.update({
    ...fields,
    ...(credentials !== undefined
      ? { credentials_encrypted: credentials ? encryptSecret(JSON.stringify(credentials)) : null }
      : {}),
    updated_by: actorId,
  })
  logger.info({ carrierAccountId: id, orgId: ctx.orgId, actorId }, 'carrier account updated')
  return getCarrierAccount(id, ctx)
}

export async function deleteCarrierAccount(id: string, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const account = await CarrierAccount.findOne({ where: { id, org_id: ctx.orgId } })
  if (!account) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')
  await account.update({ is_active: false, deleted_by: actorId })
  await account.destroy()
  logger.info({ carrierAccountId: id, orgId: ctx.orgId, actorId }, 'carrier account deleted')
}

/** Uso interno de providers con API (phase 2). Nunca exponer por HTTP. */
export function getCarrierCredentials(account: CarrierAccount): Record<string, string> | null {
  if (!account.credentials_encrypted) return null
  const plain = decryptSecret(account.credentials_encrypted)
  if (!plain) return null
  return JSON.parse(plain) as Record<string, string>
}
