import 'server-only'
import { Op, QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { whereOrg, type TenantContext } from '@/lib/tenancy'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Campaign from './campaign.model'
import CampaignTarget from './campaign-target.model'
import { ensureCampaignAssociations } from './campaign-associations'
import { analyzeMargin, summarizeMargins, type MarginResult, type MarginSummary } from './campaign-margin.math'
import type { CampaignInput } from './campaign.schema'

/** Tope de variantes a analizar en detalle (evita escaneos gigantes en campañas sin targets). */
const MAX_VARIANTS = 500
const DEFAULT_WINDOW_DAYS = 90

interface TargetLike {
  target_kind: string
  category_id: string | null
  product_id: string | null
  variant_id: string | null
  brand: string | null
  is_exclusion: boolean
}

export interface CampaignMarginRow extends MarginResult {
  variant_id: string
  sku: string
  name: string
}

export interface CampaignProjection {
  window_days: number
  units: string
  revenue: string
  current_margin: string
  estimated_discount: string
  projected_margin: string
  projected_is_loss: boolean
}

export interface CampaignAnalysis {
  /** false para premios no monetarios (cuotas): no hay descuento sobre el precio. */
  applicable: boolean
  discount_pct: string | null
  scope: 'targeted' | 'all_products'
  truncated: boolean
  rows: CampaignMarginRow[]
  summary: MarginSummary
  projection: CampaignProjection | null
}

async function productIdsForTargets(targets: TargetLike[], orgId: string): Promise<Set<string>> {
  const productIds = new Set<string>()

  const categoryIds = targets.filter((t) => t.target_kind === 'category' && t.category_id).map((t) => t.category_id as string)
  const directProductIds = targets.filter((t) => t.target_kind === 'product' && t.product_id).map((t) => t.product_id as string)
  const brands = targets.filter((t) => t.target_kind === 'brand' && t.brand).map((t) => (t.brand as string).trim())

  directProductIds.forEach((id) => productIds.add(id))

  if (categoryIds.length > 0 || brands.length > 0) {
    const or: Record<string, unknown>[] = []
    if (categoryIds.length > 0) or.push({ category_id: { [Op.in]: [...new Set(categoryIds)] } })
    for (const brand of new Set(brands)) or.push({ vendor: { [Op.iLike]: brand } })
    const products = await Product.findAll({
      where: whereOrg(ctxOrg(orgId), { [Op.or]: or }),
      attributes: ['id'],
      limit: 5000,
    })
    products.forEach((p) => productIds.add(p.id))
  }

  return productIds
}

// whereOrg necesita un TenantContext; para queries de catálogo solo usa orgId.
function ctxOrg(orgId: string): TenantContext {
  return { orgId } as TenantContext
}

/** Ids de variante afectadas por los targets (inclusión − exclusión). */
async function resolveAffectedVariantIds(
  targets: TargetLike[],
  orgId: string,
): Promise<{ variantIds: string[]; scope: 'targeted' | 'all_products'; truncated: boolean }> {
  const inclusions = targets.filter((t) => !t.is_exclusion)
  const exclusions = targets.filter((t) => t.is_exclusion)

  const included = new Set<string>()
  let scope: 'targeted' | 'all_products' = 'targeted'

  if (inclusions.length === 0) {
    // Sin condiciones de producto: la campaña aplica a todo. Analizamos una muestra acotada.
    scope = 'all_products'
    const variants = await ProductVariant.findAll({
      where: whereOrg(ctxOrg(orgId)),
      attributes: ['id'],
      limit: MAX_VARIANTS + 1,
      order: [['base_price', 'DESC']],
    })
    variants.forEach((v) => included.add(v.id))
  } else {
    inclusions.filter((t) => t.target_kind === 'variant' && t.variant_id).forEach((t) => included.add(t.variant_id as string))
    const productIds = await productIdsForTargets(inclusions, orgId)
    if (productIds.size > 0) {
      const variants = await ProductVariant.findAll({
        where: whereOrg(ctxOrg(orgId), { product_id: { [Op.in]: [...productIds] } }),
        attributes: ['id'],
        limit: MAX_VARIANTS + 1,
      })
      variants.forEach((v) => included.add(v.id))
    }
  }

  // Exclusiones.
  if (exclusions.length > 0) {
    exclusions.filter((t) => t.target_kind === 'variant' && t.variant_id).forEach((t) => included.delete(t.variant_id as string))
    const exclProductIds = await productIdsForTargets(exclusions, orgId)
    if (exclProductIds.size > 0) {
      const exclVariants = await ProductVariant.findAll({
        where: whereOrg(ctxOrg(orgId), { product_id: { [Op.in]: [...exclProductIds] } }),
        attributes: ['id'],
      })
      exclVariants.forEach((v) => included.delete(v.id))
    }
  }

  const all = [...included]
  return { variantIds: all.slice(0, MAX_VARIANTS), scope, truncated: all.length > MAX_VARIANTS }
}

async function projectImpact(
  variantIds: string[],
  discountPct: string,
  windowDays: number,
  orgId: string,
): Promise<CampaignProjection | null> {
  if (variantIds.length === 0) return null

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const rows = await sequelize.query<{ units: string; revenue: string; cogs: string }>(
    `SELECT COALESCE(SUM(ii.quantity), 0)                  AS units,
            COALESCE(SUM(ii.quantity * ii.unit_price), 0)  AS revenue,
            COALESCE(SUM(ii.quantity * ii.unit_cost), 0)   AS cogs
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id AND i.deleted_at IS NULL
      WHERE ii.org_id = :orgId
        AND ii.deleted_at IS NULL
        AND ii.variant_id IN (:variantIds)
        AND i.created_at >= :since`,
    { replacements: { orgId, variantIds, since }, type: QueryTypes.SELECT },
  )

  const agg = rows[0] ?? { units: '0', revenue: '0', cogs: '0' }
  const revenue = new Decimal(agg.revenue || 0)
  const cogs = new Decimal(agg.cogs || 0)
  const currentMargin = revenue.minus(cogs)
  const estimatedDiscount = revenue.mul(discountPct).div(100)
  const projectedMargin = currentMargin.minus(estimatedDiscount)

  return {
    window_days: windowDays,
    units: new Decimal(agg.units || 0).toFixed(2),
    revenue: revenue.toFixed(2),
    current_margin: currentMargin.toFixed(2),
    estimated_discount: estimatedDiscount.toFixed(2),
    projected_margin: projectedMargin.toFixed(2),
    projected_is_loss: projectedMargin.lt(0),
  }
}

async function loadTargets(campaignId: string, ctx: TenantContext): Promise<{ rewardKind: string; rewardPercent: string | null; targets: TargetLike[] }> {
  ensureCampaignAssociations()
  const campaign = (await Campaign.findOne({
    where: whereOrg(ctx, { id: campaignId }),
    include: [{ model: CampaignTarget, as: 'targets' }],
  })) as (Campaign & { targets?: CampaignTarget[] }) | null
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')
  return {
    rewardKind: campaign.reward_kind,
    rewardPercent: campaign.reward_percent,
    targets: (campaign.targets ?? []).map((t) => ({
      target_kind: t.target_kind, category_id: t.category_id, product_id: t.product_id,
      variant_id: t.variant_id, brand: t.brand, is_exclusion: t.is_exclusion,
    })),
  }
}

function targetsFromDraft(draft: CampaignInput): { rewardKind: string; rewardPercent: string | null; targets: TargetLike[] } {
  return {
    rewardKind: draft.reward_kind,
    rewardPercent: draft.reward_percent ?? null,
    targets: (draft.targets ?? []).map((t) => ({
      target_kind: t.target_kind, category_id: t.category_id ?? null, product_id: t.product_id ?? null,
      variant_id: t.variant_id ?? null, brand: t.brand ?? null, is_exclusion: t.is_exclusion ?? false,
    })),
  }
}

/**
 * Analiza la rentabilidad de una campaña porcentual: por cada variante afectada compara el precio
 * con descuento contra el costo (`cost_price`), marca las que quedan en pérdida y calcula el
 * descuento máximo seguro. Suma una proyección del impacto sobre las ventas de los últimos N días.
 */
export async function analyzeCampaign(
  input: { campaignId?: string; draft?: CampaignInput; windowDays?: number },
  ctx: TenantContext,
): Promise<CampaignAnalysis> {
  const meta = input.campaignId
    ? await loadTargets(input.campaignId, ctx)
    : input.draft
      ? targetsFromDraft(input.draft)
      : (() => { throw new Error('CAMPAIGN_ANALYSIS_INPUT_REQUIRED') })()

  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS

  // Solo las campañas porcentuales descuentan sobre el precio; cuotas no afectan el margen.
  if (meta.rewardKind !== 'percent' || meta.rewardPercent == null) {
    return {
      applicable: false, discount_pct: null, scope: 'targeted', truncated: false,
      rows: [], summary: summarizeMargins([]), projection: null,
    }
  }

  const discountPct = meta.rewardPercent
  const { variantIds, scope, truncated } = await resolveAffectedVariantIds(meta.targets, ctx.orgId)

  const variants = variantIds.length > 0
    ? await ProductVariant.findAll({
        where: whereOrg(ctx, { id: { [Op.in]: variantIds } }),
        attributes: ['id', 'sku', 'name', 'base_price', 'cost_price', 'product_id'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'], required: false }],
      })
    : []

  const rows: CampaignMarginRow[] = variants.map((v) => {
    const margin = analyzeMargin(v.base_price, v.cost_price, discountPct)
    const productName = (v as unknown as { product?: { name?: string } }).product?.name ?? null
    return {
      ...margin,
      variant_id: v.id,
      sku: v.sku,
      name: v.name ?? productName ?? v.sku,
    }
  })
  // Peores primero (más cerca de la pérdida).
  rows.sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct))

  const projection = await projectImpact(variantIds, discountPct, windowDays, ctx.orgId)

  return {
    applicable: true,
    discount_pct: discountPct,
    scope,
    truncated,
    rows,
    summary: summarizeMargins(rows),
    projection,
  }
}
