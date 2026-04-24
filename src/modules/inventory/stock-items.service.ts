import 'server-only'
import { Op } from 'sequelize'
import { paginate, toPaginated } from '@/lib/pagination'
import StockItem from './stock-item.model'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import type { StockLevelQuery } from './stock-level.schema'

export async function getStockLevels(query: StockLevelQuery, orgId: string) {
  const { page, limit, warehouse_id, search } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (warehouse_id) where.warehouse_id = warehouse_id
  if (search) {
    const like = `%${search}%`
    where[Op.or as unknown as string] = [
      { '$variant.sku$':          { [Op.iLike]: like } },
      { '$variant.name$':         { [Op.iLike]: like } },
      { '$variant.product.name$': { [Op.iLike]: like } },
    ]
  }

  const { rows, count } = await StockItem.findAndCountAll({
    where,
    limit,
    offset,
    subQuery: false,
    order: [['warehouse_id', 'ASC'], ['variant_id', 'ASC']],
    include: [
      { model: Warehouse,      as: 'warehouse', attributes: ['id', 'name', 'branch_id'] },
      {
        model:      ProductVariant,
        as:         'variant',
        attributes: ['id', 'sku', 'name', 'is_default'],
        required:   !!search,
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getVariantStock(variantId: string, warehouseId: string): Promise<string> {
  const item = await StockItem.findOne({ where: { variant_id: variantId, warehouse_id: warehouseId } })
  return item?.quantity ?? '0'
}
