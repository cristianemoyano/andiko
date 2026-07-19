import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import Campaign from './campaign.model'
import Coupon from './coupon.model'
import { getCampaign } from './campaigns.service'
import { CAMPAIGN_WARNINGS, type CampaignWarningCode } from './campaign.constants'
import type { CouponInput, CouponUpdateInput } from './coupon.schema'
import type { UUID } from '@/types'

export async function listCoupons(campaignId: UUID, ctx: TenantContext) {
  await getCampaign(campaignId, ctx)
  return Coupon.findAll({
    where: whereOrg(ctx, { campaign_id: campaignId }),
    order: [['created_at', 'DESC']],
  })
}

export async function createCoupon(campaignId: UUID, input: CouponInput, ctx: TenantContext, actorId: UUID) {
  await getCampaign(campaignId, ctx)
  const coupon = await Coupon.create({
    ...input,
    campaign_id: campaignId,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ couponId: coupon.id, campaignId, actorId }, 'coupon created')
  return coupon
}

export async function updateCoupon(couponId: UUID, input: CouponUpdateInput, ctx: TenantContext, actorId: UUID) {
  const coupon = await Coupon.findOne({ where: whereOrg(ctx, { id: couponId }) })
  if (!coupon) throw new Error('COUPON_NOT_FOUND')
  await coupon.update({ ...input, updated_by: actorId })
  return coupon
}

export async function deleteCoupon(couponId: UUID, ctx: TenantContext, actorId: UUID) {
  const coupon = await Coupon.findOne({ where: whereOrg(ctx, { id: couponId }) })
  if (!coupon) throw new Error('COUPON_NOT_FOUND')
  await coupon.update({ deleted_by: actorId })
  await coupon.destroy()
  logger.info({ couponId, actorId }, 'coupon deleted')
}

export interface ValidCoupon {
  couponId: UUID
  campaignId: UUID
}

export type CouponValidation =
  | { ok: true; coupon: Coupon; campaign: Campaign }
  | { ok: false; code: CampaignWarningCode }

/** Valida un código de cupón contra la campaña asociada (vigencia + estado + límites). Read-only. */
export async function validateCoupon(code: string, ctx: TenantContext): Promise<CouponValidation> {
  const coupon = await Coupon.findOne({ where: whereOrg(ctx, { code, is_active: true }) })
  if (!coupon) return { ok: false, code: CAMPAIGN_WARNINGS.COUPON_NOT_FOUND }

  if (coupon.max_redemptions != null && coupon.redeemed_count >= coupon.max_redemptions) {
    return { ok: false, code: CAMPAIGN_WARNINGS.COUPON_LIMIT_REACHED }
  }

  const campaign = await Campaign.findOne({ where: whereOrg(ctx, { id: coupon.campaign_id, is_active: true }) })
  if (!campaign) return { ok: false, code: CAMPAIGN_WARNINGS.COUPON_EXPIRED }

  const now = new Date()
  if (now < campaign.valid_from || now > campaign.valid_to) {
    return { ok: false, code: CAMPAIGN_WARNINGS.COUPON_EXPIRED }
  }

  return { ok: true, coupon, campaign }
}

/** Devuelve, para los códigos dados, un mapa campaign_id → coupon_id de cupones válidos. */
export async function resolveValidCouponsByCodes(
  codes: string[],
  ctx: TenantContext,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (codes.length === 0) return map

  const coupons = await Coupon.findAll({
    where: whereOrg(ctx, { code: { [Op.in]: codes }, is_active: true }),
  })
  for (const coupon of coupons) {
    if (coupon.max_redemptions != null && coupon.redeemed_count >= coupon.max_redemptions) continue
    map.set(coupon.campaign_id, coupon.id)
  }
  return map
}
