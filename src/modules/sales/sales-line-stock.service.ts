import 'server-only'
import Decimal from 'decimal.js'
import { Op, type Transaction } from 'sequelize'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from '@/modules/inventory/stock-item.model'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'

export type BranchVariantStock = {
  variant_id: string
  quantity: string
  manage_stock: boolean
  allow_backorder: boolean
}

export type SaleLineStockRef = {
  variant_id: string
  quantity: number
}

export class SaleLineStockError extends Error {
  readonly code = 'SALE_LINE_INSUFFICIENT_STOCK' as const

  readonly line: number

  readonly available: string

  readonly requested: string

  constructor(message: string, line: number, available: string, requested: string) {
    super(message)
    this.name = 'SaleLineStockError'
    this.line = line
    this.available = available
    this.requested = requested
  }
}

export async function getBranchVariantStock(
  branchId: string,
  variantIds: string[],
  orgId: string,
  transaction?: Transaction,
): Promise<BranchVariantStock[]> {
  const uniqueIds = [...new Set(variantIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: uniqueIds }, org_id: orgId },
    attributes: ['id', 'manage_stock', 'allow_backorder', 'product_id'],
    include: [{
      model: Product,
      as: 'product',
      required: true,
      attributes: ['product_type'],
      where: { org_id: orgId },
    }],
    transaction,
  })

  const variantMeta = new Map(
    variants.map((v) => {
      const product = v.get('product') as Product | undefined
      const isService = product?.product_type === 'service'
      return [v.id, {
        manage_stock: !isService && Boolean(v.manage_stock),
        allow_backorder: !isService && Boolean(v.manage_stock) && Boolean(v.allow_backorder),
      }]
    }),
  )

  const warehouseId = await resolveWarehouseForBranch(branchId, orgId, transaction)
  const stockByVariant = new Map<string, string>()

  const rows = await StockItem.findAll({
    where: {
      org_id: orgId,
      warehouse_id: warehouseId,
      variant_id: { [Op.in]: uniqueIds },
    },
    attributes: ['variant_id', 'quantity'],
    transaction,
  })
  for (const row of rows) {
    stockByVariant.set(row.variant_id, row.quantity)
  }

  return uniqueIds.map((variantId) => {
    const meta = variantMeta.get(variantId)
    return {
      variant_id: variantId,
      quantity: stockByVariant.get(variantId) ?? '0',
      manage_stock: meta?.manage_stock ?? false,
      allow_backorder: meta?.allow_backorder ?? false,
    }
  })
}

/** Valida stock en el depósito de la sucursal para líneas con control de inventario. */
export async function assertSaleLineItemsHaveBranchStock(
  items: SaleLineStockRef[],
  branchId: string,
  orgId: string,
  transaction?: Transaction,
): Promise<void> {
  if (items.length === 0) return

  const variantIds = [...new Set(items.map((item) => item.variant_id))]
  const stockRows = await getBranchVariantStock(branchId, variantIds, orgId, transaction)
  const stockByVariant = new Map(stockRows.map((row) => [row.variant_id, row]))

  const demandByVariant = new Map<string, { total: Decimal; firstLine: number }>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const stock = stockByVariant.get(item.variant_id)
    if (!stock?.manage_stock || stock.allow_backorder) continue

    const qty = new Decimal(item.quantity)
    if (qty.lte(0)) continue

    const prev = demandByVariant.get(item.variant_id)
    if (prev) {
      prev.total = prev.total.plus(qty)
    } else {
      demandByVariant.set(item.variant_id, { total: qty, firstLine: i + 1 })
    }
  }

  for (const [variantId, demand] of demandByVariant) {
    const stock = stockByVariant.get(variantId)!
    if (stock.allow_backorder) continue
    const available = new Decimal(stock.quantity)
    if (demand.total.gt(available)) {
      throw new SaleLineStockError(
        `Stock insuficiente en la línea ${demand.firstLine}. Disponible: ${available.toFixed(4).replace(/\.?0+$/, '')}, solicitado: ${demand.total.toFixed(4).replace(/\.?0+$/, '')}. Transferí mercadería al depósito de la sucursal antes de vender.`,
        demand.firstLine,
        available.toFixed(4),
        demand.total.toFixed(4),
      )
    }
  }
}
