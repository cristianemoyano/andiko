import type { Transaction } from 'sequelize'
import ProductVariant from '@/modules/catalog/product-variant.model'

export async function resolveVariantUnitCosts(
  variantIds: Array<string | null | undefined>,
  orgId: string,
  transaction?: Transaction,
): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(variantIds.filter((id): id is string => !!id))]
  if (uniqueIds.length === 0) return new Map()

  const variants = await ProductVariant.findAll({
    where: { id: uniqueIds, org_id: orgId },
    attributes: ['id', 'cost_price'],
    transaction,
  })

  return new Map(variants.map(v => [v.id, v.cost_price]))
}

export function snapshotUnitCost(
  variantId: string | null | undefined,
  costByVariant: Map<string, string | null>,
): string | null {
  if (!variantId) return null
  return costByVariant.get(variantId) ?? null
}
