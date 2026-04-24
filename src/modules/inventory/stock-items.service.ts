import 'server-only'
import { paginate, toPaginated } from '@/lib/pagination'
import StockItem from './stock-item.model'
import Warehouse from './warehouse.model'
import type { StockLevelQuery } from './stock-level.schema'

export async function getStockLevels(query: StockLevelQuery, orgId: string) {
  const { page, limit, warehouse_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (warehouse_id) where.warehouse_id = warehouse_id

  const { rows, count } = await StockItem.findAndCountAll({
    where,
    limit,
    offset,
    order: [['warehouse_id', 'ASC'], ['variant_id', 'ASC']],
    include: [
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'branch_id'] },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getVariantStock(variantId: string, warehouseId: string): Promise<string> {
  const item = await StockItem.findOne({ where: { variant_id: variantId, warehouse_id: warehouseId } })
  return item?.quantity ?? '0'
}
