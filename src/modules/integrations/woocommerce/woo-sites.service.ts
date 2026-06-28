import 'server-only'
import { randomBytes } from 'node:crypto'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { env } from '@/config/env'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import Branch from '@/modules/auth/branch.model'
import WoocommerceSite from './woocommerce-site.model'
import { WooClient } from './woo-client'
import { invalidateSiteCache } from './woo-stock.service'
import type { WoocommerceSiteInput, WoocommerceSiteUpdateInput, WoocommerceSiteQuery } from './woocommerce.schema'

/** API-safe projection: never expose encrypted secrets. */
export function toPublicSite(site: WoocommerceSite) {
  return {
    id: site.id,
    org_id: site.org_id,
    branch_id: site.branch_id,
    name: site.name,
    store_url: site.store_url,
    price_list_id: site.price_list_id,
    default_contact_id: site.default_contact_id,
    auto_publish: site.auto_publish,
    stock_safety_buffer: site.stock_safety_buffer,
    is_active: site.is_active,
    has_webhook_secret: !!site.webhook_secret_encrypted,
    last_order_synced_at: site.last_order_synced_at,
    last_stock_pushed_at: site.last_stock_pushed_at,
    created_at: site.created_at,
    updated_at: site.updated_at,
  }
}

async function assertBranchInOrg(branchId: string, orgId: string): Promise<void> {
  const branch = await Branch.findOne({ where: { id: branchId, org_id: orgId }, attributes: ['id'] })
  if (!branch) throw new Error('BRANCH_NOT_FOUND')
}

export async function listSites(query: WoocommerceSiteQuery, ctx: TenantContext) {
  const { page, limit, search, branch_id, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: ctx.orgId }
  if (branch_id) where.branch_id = branch_id
  if (is_active !== undefined) where.is_active = is_active
  if (search) where.name = { [Op.iLike]: `%${search}%` }

  const { rows, count } = await WoocommerceSite.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
  })

  return toPaginated(rows.map(toPublicSite), count, page, limit)
}

export async function getSite(id: string, orgId: string): Promise<WoocommerceSite> {
  const site = await WoocommerceSite.findOne({ where: { id, org_id: orgId } })
  if (!site) throw new Error('SITE_NOT_FOUND')
  return site
}

export async function createSite(input: WoocommerceSiteInput, ctx: TenantContext, actorId: string) {
  await assertBranchInOrg(input.branch_id, ctx.orgId)

  const webhookSecret = input.webhook_secret ?? randomBytes(24).toString('hex')

  const site = await WoocommerceSite.create({
    org_id: ctx.orgId,
    branch_id: input.branch_id,
    name: input.name,
    store_url: input.store_url,
    consumer_key_encrypted: encryptSecret(input.consumer_key),
    consumer_secret_encrypted: encryptSecret(input.consumer_secret),
    webhook_secret_encrypted: encryptSecret(webhookSecret),
    price_list_id: input.price_list_id ?? null,
    default_contact_id: input.default_contact_id ?? null,
    auto_publish: input.auto_publish,
    stock_safety_buffer: input.stock_safety_buffer,
    is_active: input.is_active,
    created_by: actorId,
    updated_by: actorId,
  })

  invalidateSiteCache(ctx.orgId)
  logger.info({ siteId: site.id, orgId: ctx.orgId, actorId }, 'woocommerce site created')

  // Best-effort: register the webhooks WooCommerce will call back on. Failure
  // here does not block site creation — polling reconciliation covers the gap.
  await registerWebhooks(site, webhookSecret).catch((err) => {
    logger.warn({ siteId: site.id, err: String(err) }, 'woocommerce webhook registration failed')
  })

  return toPublicSite(site)
}

export async function updateSite(
  id: string,
  input: WoocommerceSiteUpdateInput,
  ctx: TenantContext,
  actorId: string,
) {
  const site = await getSite(id, ctx.orgId)
  if (input.branch_id) await assertBranchInOrg(input.branch_id, ctx.orgId)

  const patch: Record<string, unknown> = { updated_by: actorId }
  for (const key of ['name', 'branch_id', 'store_url', 'price_list_id', 'default_contact_id', 'auto_publish', 'stock_safety_buffer', 'is_active'] as const) {
    if (input[key] !== undefined) patch[key] = input[key]
  }
  if (input.consumer_key !== undefined) patch.consumer_key_encrypted = encryptSecret(input.consumer_key)
  if (input.consumer_secret !== undefined) patch.consumer_secret_encrypted = encryptSecret(input.consumer_secret)
  if (input.webhook_secret) patch.webhook_secret_encrypted = encryptSecret(input.webhook_secret)

  await site.update(patch)
  invalidateSiteCache(ctx.orgId)
  logger.info({ siteId: id, orgId: ctx.orgId, actorId }, 'woocommerce site updated')
  return toPublicSite(site)
}

export async function deleteSite(id: string, ctx: TenantContext, actorId: string) {
  const site = await getSite(id, ctx.orgId)
  await site.update({ deleted_by: actorId })
  await site.destroy()
  invalidateSiteCache(ctx.orgId)
  logger.info({ siteId: id, orgId: ctx.orgId, actorId }, 'woocommerce site soft-deleted')
}

/** Decrypts the site's stored webhook secret (null if unset/tampered). */
export function getWebhookSecret(site: WoocommerceSite): string | null {
  return site.webhook_secret_encrypted ? decryptSecret(site.webhook_secret_encrypted) : null
}

/** Builds an authenticated WooCommerce REST client for a site. */
export function buildClientForSite(site: WoocommerceSite): WooClient {
  const key = decryptSecret(site.consumer_key_encrypted)
  const secret = decryptSecret(site.consumer_secret_encrypted)
  if (!key || !secret) throw new Error('SITE_CREDENTIALS_INVALID')
  return new WooClient({ storeUrl: site.store_url, consumerKey: key, consumerSecret: secret })
}

async function registerWebhooks(site: WoocommerceSite, secret: string): Promise<void> {
  const client = buildClientForSite(site)
  const deliveryUrl = `${env.AUTH_URL.replace(/\/+$/, '')}/api/v1/integrations/woocommerce/${site.id}/webhooks`
  for (const topic of ['order.created', 'order.updated', 'order.deleted']) {
    await client.createWebhook(topic, deliveryUrl, secret)
  }
}
