import 'server-only'
import { Op, type Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { whereOrg, whereBranch, type TenantContext } from '@/lib/tenancy'
import { paginate, toPaginated } from '@/lib/pagination'
import Campaign from './campaign.model'
import CampaignTarget from './campaign-target.model'
import CampaignPaymentRule from './campaign-payment-rule.model'
import Coupon from './coupon.model'
import { ensureCampaignAssociations } from './campaign-associations'
import type { CampaignInput, CampaignUpdateInput, CampaignQuery, CampaignTargetInput, CampaignPaymentRuleInput } from './campaign.schema'
import type { UUID } from '@/types'

const CAMPAIGN_INCLUDE = () => {
  ensureCampaignAssociations()
  return [
    { model: CampaignTarget, as: 'targets' },
    { model: CampaignPaymentRule, as: 'paymentRules' },
    { model: Coupon, as: 'coupons' },
  ]
}

export async function listCampaigns(query: CampaignQuery, ctx: TenantContext) {
  const { page, limit, search, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereOrg(ctx)
  if (is_active !== undefined) where.is_active = is_active
  if (search) where.name = { [Op.iLike]: `%${search}%` }

  const { rows, count } = await Campaign.findAndCountAll({
    where,
    limit,
    offset,
    order: [['priority', 'ASC'], ['valid_from', 'DESC'], ['name', 'ASC']],
    attributes: [
      'id', 'name', 'reward_kind', 'reward_percent', 'installments_count', 'installments_interest_free',
      'requires_coupon', 'stackable', 'priority', 'valid_from', 'valid_to', 'is_active', 'created_at',
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getCampaign(id: UUID, ctx: TenantContext) {
  const campaign = await Campaign.findOne({
    where: whereOrg(ctx, { id }),
    include: CAMPAIGN_INCLUDE(),
  })
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')
  return campaign
}

async function replaceChildren(
  campaignId: UUID,
  orgId: string,
  actorId: UUID,
  targets: CampaignTargetInput[] | undefined,
  paymentRules: CampaignPaymentRuleInput[] | undefined,
  t: Transaction,
  isUpdate: boolean,
) {
  if (targets !== undefined || isUpdate) {
    await CampaignTarget.destroy({ where: { campaign_id: campaignId, org_id: orgId }, transaction: t, force: true })
    if (targets && targets.length > 0) {
      await CampaignTarget.bulkCreate(
        targets.map((tg) => ({
          campaign_id: campaignId,
          org_id: orgId,
          target_kind: tg.target_kind,
          category_id: tg.category_id ?? null,
          product_id: tg.product_id ?? null,
          variant_id: tg.variant_id ?? null,
          is_exclusion: tg.is_exclusion ?? false,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }
  }

  if (paymentRules !== undefined || isUpdate) {
    await CampaignPaymentRule.destroy({ where: { campaign_id: campaignId, org_id: orgId }, transaction: t, force: true })
    if (paymentRules && paymentRules.length > 0) {
      await CampaignPaymentRule.bulkCreate(
        paymentRules.map((r) => ({
          campaign_id: campaignId,
          org_id: orgId,
          payment_method: r.payment_method ?? null,
          payment_condition: r.payment_condition ?? null,
          wallet: r.wallet ?? null,
          card_brand: r.card_brand ?? null,
          card_type: r.card_type ?? null,
          via_qr: r.via_qr ?? null,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }
  }
}

export async function createCampaign(input: CampaignInput, ctx: TenantContext, actorId: UUID) {
  const { targets, payment_rules, branch_id, ...fields } = input
  if (branch_id) void whereBranch(ctx, branch_id) // valida acceso a la sucursal

  const campaign = await sequelize.transaction(async (t) => {
    const created = await Campaign.create(
      {
        ...fields,
        branch_id: branch_id ?? null,
        valid_from: new Date(fields.valid_from),
        valid_to: new Date(fields.valid_to),
        org_id: ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )
    await replaceChildren(created.id, ctx.orgId, actorId, targets, payment_rules, t, false)
    return created
  })

  logger.info({ campaignId: campaign.id, orgId: ctx.orgId, actorId }, 'campaign created')
  return getCampaign(campaign.id, ctx)
}

export async function updateCampaign(id: UUID, input: CampaignUpdateInput, ctx: TenantContext, actorId: UUID) {
  const campaign = await Campaign.findOne({ where: whereOrg(ctx, { id }) })
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')

  const { targets, payment_rules, branch_id, valid_from, valid_to, ...fields } = input
  if (branch_id) void whereBranch(ctx, branch_id)

  await sequelize.transaction(async (t) => {
    await campaign.update(
      {
        ...fields,
        ...(branch_id !== undefined ? { branch_id: branch_id ?? null } : {}),
        ...(valid_from ? { valid_from: new Date(valid_from) } : {}),
        ...(valid_to ? { valid_to: new Date(valid_to) } : {}),
        updated_by: actorId,
      },
      { transaction: t },
    )
    if (targets !== undefined || payment_rules !== undefined) {
      await replaceChildren(id, ctx.orgId, actorId, targets, payment_rules, t, false)
    }
  })

  logger.info({ campaignId: id, orgId: ctx.orgId, actorId }, 'campaign updated')
  return getCampaign(id, ctx)
}

export async function setCampaignActive(id: UUID, isActive: boolean, ctx: TenantContext, actorId: UUID) {
  const campaign = await Campaign.findOne({ where: whereOrg(ctx, { id }) })
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')
  await campaign.update({ is_active: isActive, updated_by: actorId })
  logger.info({ campaignId: id, isActive, actorId }, 'campaign active toggled')
  return campaign
}

export async function deleteCampaign(id: UUID, ctx: TenantContext, actorId: UUID) {
  const campaign = await Campaign.findOne({ where: whereOrg(ctx, { id }) })
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')
  await campaign.update({ deleted_by: actorId })
  await campaign.destroy()
  logger.info({ campaignId: id, actorId }, 'campaign deleted')
}
