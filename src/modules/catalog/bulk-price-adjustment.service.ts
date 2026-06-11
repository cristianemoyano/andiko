import 'server-only'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import Product from './product.model'
import ProductVariant from './product-variant.model'
import { getPriceList } from './price-list.service'
import type { BulkPriceAdjustmentInput, BulkPriceAdjustmentPreview, BulkPriceAdjustmentResult } from './bulk-price-adjustment.schema'
import type { UUID } from '@/types'

const PREVIEW_SAMPLE_SIZE = 5

function orgWhere(orgId: string | null) {
  return { org_id: orgId ?? null }
}

function applyAdjustment(current: string, input: BulkPriceAdjustmentInput): string {
  const price = new Decimal(current)
  const val = new Decimal(input.value)

  switch (input.adjustment_type) {
    case 'percent_increase':
      return price.mul(new Decimal(1).add(val.div(100))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'percent_decrease':
      return price.mul(new Decimal(1).sub(val.div(100))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'fixed_increase':
      return price.add(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'fixed_decrease':
      return Decimal.max(0, price.sub(val)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    case 'set':
      return val.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    default:
      return price.toFixed(2)
  }
}

async function loadVariantsWithPrices(
  input: BulkPriceAdjustmentInput,
  orgId: string | null,
): Promise<Array<{ id: UUID; sku: string; current_price: string }>> {
  const productWhere: Record<string, unknown> = { ...orgWhere(orgId), status: 'active' }
  if (input.category_id) productWhere.category_id = input.category_id

  const variants = await ProductVariant.findAll({
    attributes: ['id', 'sku', 'base_price'],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['id'],
      required: true,
      where: productWhere,
    }],
    order: [['sku', 'ASC']],
  })

  if (input.target === 'base_price') {
    return variants
      .filter(v => v.base_price != null)
      .map(v => ({ id: v.id, sku: v.sku, current_price: v.base_price! }))
  }

  const priceListId = input.price_list_id!
  await getPriceList(priceListId, orgId)

  const { default: PriceListItem } = await import('./price-list-item.model')
  const listItems = await PriceListItem.findAll({
    where: { price_list_id: priceListId, ...orgWhere(orgId) },
    attributes: ['product_variant_id', 'price'],
  })
  const priceByVariant = new Map(listItems.map(i => [i.product_variant_id, i.price]))

  return variants
    .map(v => {
      const current = priceByVariant.get(v.id) ?? v.base_price
      if (current == null) return null
      return { id: v.id, sku: v.sku, current_price: current }
    })
    .filter((row): row is { id: UUID; sku: string; current_price: string } => row !== null)
}

export async function previewBulkPriceAdjustment(
  input: BulkPriceAdjustmentInput,
  orgId: string | null,
): Promise<BulkPriceAdjustmentPreview> {
  const rows = await loadVariantsWithPrices(input, orgId)
  const sample = rows.slice(0, PREVIEW_SAMPLE_SIZE).map(r => ({
    variant_id: r.id,
    sku: r.sku,
    current_price: r.current_price,
    new_price: applyAdjustment(r.current_price, input),
  }))
  return { affected_count: rows.length, sample }
}

export async function applyBulkPriceAdjustment(
  input: BulkPriceAdjustmentInput,
  orgId: string | null,
  actorId: UUID,
): Promise<BulkPriceAdjustmentResult> {
  if (input.dry_run) {
    const preview = await previewBulkPriceAdjustment(input, orgId)
    return { ...preview, updated_count: 0 }
  }

  const rows = await loadVariantsWithPrices(input, orgId)
  if (rows.length === 0) {
    return { affected_count: 0, sample: [], updated_count: 0 }
  }

  const updates = rows.map(r => ({
    ...r,
    new_price: applyAdjustment(r.current_price, input),
  }))

  await sequelize.transaction(async (t) => {
    if (input.target === 'base_price') {
      for (const row of updates) {
        await ProductVariant.update(
          { base_price: row.new_price, updated_by: actorId },
          { where: { id: row.id, ...orgWhere(orgId) }, transaction: t },
        )
      }
    } else {
      const priceListId = input.price_list_id!
      for (const row of updates) {
        // setPriceListItem runs its own transaction — call sequentially inside outer tx
        // by inlining the soft-delete + create pattern here for atomicity
        const { default: PriceListItem } = await import('./price-list-item.model')
        await PriceListItem.update(
          { deleted_by: actorId },
          { where: { price_list_id: priceListId, product_variant_id: row.id, ...orgWhere(orgId) }, transaction: t },
        )
        await PriceListItem.destroy({
          where: { price_list_id: priceListId, product_variant_id: row.id, ...orgWhere(orgId) },
          transaction: t,
        })
        await PriceListItem.create(
          {
            price_list_id: priceListId,
            product_variant_id: row.id,
            org_id: orgId ?? null,
            price: row.new_price,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: t },
        )
      }
    }
  })

  logger.info(
    { orgId, target: input.target, category_id: input.category_id, count: updates.length, actorId },
    'bulk price adjustment applied',
  )

  const sample = updates.slice(0, PREVIEW_SAMPLE_SIZE).map(r => ({
    variant_id: r.id,
    sku: r.sku,
    current_price: r.current_price,
    new_price: r.new_price,
  }))

  return {
    affected_count: updates.length,
    updated_count: updates.length,
    sample,
  }
}
