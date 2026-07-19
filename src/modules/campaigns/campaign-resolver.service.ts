import 'server-only'
import { Op } from 'sequelize'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Campaign from './campaign.model'
import CampaignTarget from './campaign-target.model'
import CampaignPaymentRule from './campaign-payment-rule.model'
import { ensureCampaignAssociations } from './campaign-associations'
import { resolveCampaigns } from './campaign-resolve.core'
import { resolveValidCouponsByCodes } from './coupon.service'
import { DEFAULT_MERGE_POLICY, type CampaignChannel, type CampaignMergePolicy } from './campaign.constants'
import type { CartLine, CartContext, CampaignRule, ResolveResult } from './campaign-resolver.types'
import type { CampaignInput } from './campaign.schema'

type CampaignWithChildren = Campaign & {
  targets?: CampaignTarget[]
  paymentRules?: CampaignPaymentRule[]
}

function toRule(campaign: CampaignWithChildren, couponId: string | null): CampaignRule {
  return {
    id: campaign.id,
    name: campaign.name,
    branch_id: campaign.branch_id,
    reward_kind: campaign.reward_kind,
    reward_percent: campaign.reward_percent,
    reward_amount: campaign.reward_amount,
    buy_qty: campaign.buy_qty,
    get_qty: campaign.get_qty,
    installments_count: campaign.installments_count,
    installments_interest_free: campaign.installments_interest_free,
    requires_coupon: campaign.requires_coupon,
    stackable: campaign.stackable,
    priority: campaign.priority,
    min_purchase_amount: campaign.min_purchase_amount,
    valid_from: new Date(campaign.valid_from),
    valid_to: new Date(campaign.valid_to),
    active_weekdays: campaign.active_weekdays,
    active_time_from: campaign.active_time_from,
    active_time_to: campaign.active_time_to,
    channels: (campaign.channels as CampaignChannel[] | null) ?? null,
    targets: (campaign.targets ?? []).map((t) => ({
      target_kind: t.target_kind,
      category_id: t.category_id,
      product_id: t.product_id,
      variant_id: t.variant_id,
      brand: t.brand,
      is_exclusion: t.is_exclusion,
    })),
    paymentRules: (campaign.paymentRules ?? []).map((r) => ({
      payment_method: r.payment_method,
      payment_condition: r.payment_condition,
      wallet: r.wallet,
      card_brand: r.card_brand,
      card_type: r.card_type,
      via_qr: r.via_qr,
    })),
    couponId,
  }
}

/**
 * Completa `category_id` y `brand` (de `product.vendor`) en las líneas que no los traen.
 * Resuelve primero `product_id` para las líneas que solo tienen `variant_id`.
 */
async function hydrateLineProductAttrs(lines: CartLine[], orgId: string): Promise<CartLine[]> {
  // 1) product_id para líneas con solo variant_id.
  const variantOnly = [...new Set(lines.filter((l) => !l.product_id && l.variant_id).map((l) => l.variant_id as string))]
  let productByVariant = new Map<string, string | null>()
  if (variantOnly.length > 0) {
    const variants = await ProductVariant.findAll({
      where: { id: { [Op.in]: variantOnly }, org_id: orgId },
      attributes: ['id', 'product_id'],
    })
    productByVariant = new Map(variants.map((v) => [v.id, (v as unknown as { product_id: string | null }).product_id]))
  }
  const withPid = lines.map((l) =>
    !l.product_id && l.variant_id ? { ...l, product_id: productByVariant.get(l.variant_id) ?? null } : l,
  )

  // 2) category_id + vendor(brand) desde el producto.
  const need = [...new Set(withPid.filter((l) => (!l.category_id || !l.brand) && l.product_id).map((l) => l.product_id as string))]
  if (need.length === 0) return withPid

  const products = await Product.findAll({
    where: { id: { [Op.in]: need }, org_id: orgId },
    attributes: ['id', 'category_id', 'vendor'],
  })
  const attrByProduct = new Map(products.map((p) => [p.id, p as unknown as { category_id: string | null; vendor: string | null }]))

  return withPid.map((l) => {
    if (!l.product_id) return l
    const a = attrByProduct.get(l.product_id)
    if (!a) return l
    return { ...l, category_id: l.category_id ?? a.category_id, brand: l.brand ?? a.vendor }
  })
}

async function loadActiveCampaignRules(cart: CartContext, ctx: TenantContext): Promise<CampaignRule[]> {
  ensureCampaignAssociations()

  const branchFilter = cart.branch_id
    ? { [Op.or]: [{ branch_id: null }, { branch_id: cart.branch_id }] }
    : { branch_id: null }

  const campaigns = (await Campaign.findAll({
    where: whereOrg(ctx, {
      is_active: true,
      valid_from: { [Op.lte]: cart.at },
      valid_to: { [Op.gte]: cart.at },
      ...branchFilter,
    }),
    include: [
      { model: CampaignTarget, as: 'targets' },
      { model: CampaignPaymentRule, as: 'paymentRules' },
    ],
  })) as CampaignWithChildren[]

  // Excluir campañas que ya alcanzaron su tope global de usos.
  const usable = campaigns.filter((c) => c.max_uses == null || c.uses_count < c.max_uses)

  const couponCampaigns = usable.filter((c) => c.requires_coupon)
  const couponMap = couponCampaigns.length > 0
    ? await resolveValidCouponsByCodes(cart.coupon_codes, cart.contact_id, ctx)
    : new Map<string, string>()

  const rules: CampaignRule[] = []
  for (const campaign of usable) {
    if (campaign.requires_coupon) {
      const couponId = couponMap.get(campaign.id)
      if (!couponId) continue // sin cupón válido → no aplica
      rules.push(toRule(campaign, couponId))
    } else {
      rules.push(toRule(campaign, null))
    }
  }
  return rules
}

/** Resuelve todas las campañas activas de la org sobre un carrito. */
export async function resolveCampaignsForCart(
  lines: CartLine[],
  cart: CartContext,
  ctx: TenantContext,
  policy: CampaignMergePolicy = DEFAULT_MERGE_POLICY,
): Promise<ResolveResult> {
  const hydrated = await hydrateLineProductAttrs(lines, ctx.orgId)
  const rules = await loadActiveCampaignRules(cart, ctx)
  return resolveCampaigns(rules, hydrated, cart, policy)
}

/** What-if de una única campaña (guardada o borrador sin persistir) para la vista previa. */
export async function previewCampaign(
  campaign: { id: string } | { draft: CampaignInput },
  lines: CartLine[],
  cart: CartContext,
  ctx: TenantContext,
  policy: CampaignMergePolicy = DEFAULT_MERGE_POLICY,
): Promise<ResolveResult> {
  const hydrated = await hydrateLineProductAttrs(lines, ctx.orgId)

  let rule: CampaignRule
  if ('id' in campaign) {
    ensureCampaignAssociations()
    const found = (await Campaign.findOne({
      where: whereOrg(ctx, { id: campaign.id }),
      include: [
        { model: CampaignTarget, as: 'targets' },
        { model: CampaignPaymentRule, as: 'paymentRules' },
      ],
    })) as CampaignWithChildren | null
    if (!found) throw new Error('CAMPAIGN_NOT_FOUND')
    rule = toRule(found, null)
  } else {
    rule = draftToRule(campaign.draft)
  }

  return resolveCampaigns([rule], hydrated, cart, policy)
}

function draftToRule(draft: CampaignInput): CampaignRule {
  return {
    id: 'draft',
    name: draft.name,
    branch_id: draft.branch_id ?? null,
    reward_kind: draft.reward_kind,
    reward_percent: draft.reward_percent ?? null,
    reward_amount: draft.reward_amount ?? null,
    buy_qty: draft.buy_qty != null ? String(draft.buy_qty) : null,
    get_qty: draft.get_qty != null ? String(draft.get_qty) : null,
    installments_count: draft.installments_count ?? null,
    installments_interest_free: draft.installments_interest_free ?? null,
    requires_coupon: draft.requires_coupon ?? false,
    stackable: draft.stackable ?? false,
    priority: draft.priority ?? 100,
    min_purchase_amount: draft.min_purchase_amount ?? null,
    valid_from: new Date(draft.valid_from),
    valid_to: new Date(draft.valid_to),
    active_weekdays: draft.active_weekdays ?? null,
    active_time_from: draft.active_time_from ?? null,
    active_time_to: draft.active_time_to ?? null,
    channels: draft.channels ?? null,
    targets: (draft.targets ?? []).map((t) => ({
      target_kind: t.target_kind,
      category_id: t.category_id ?? null,
      product_id: t.product_id ?? null,
      variant_id: t.variant_id ?? null,
      brand: t.brand ?? null,
      is_exclusion: t.is_exclusion ?? false,
    })),
    paymentRules: (draft.payment_rules ?? []).map((r) => ({
      payment_method: r.payment_method ?? null,
      payment_condition: r.payment_condition ?? null,
      wallet: r.wallet ?? null,
      card_brand: r.card_brand ?? null,
      card_type: r.card_type ?? null,
      via_qr: r.via_qr ?? null,
    })),
    couponId: null,
  }
}
