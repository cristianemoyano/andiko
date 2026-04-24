import 'server-only'
import Decimal from 'decimal.js'
import { Op, literal } from 'sequelize'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import StockItem from './stock-item.model'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import type { StockItemAlertsPatchInput, StockLevelQuery } from './stock-level.schema'
import { getWarehouse } from './warehouses.service'

export async function getStockLevels(query: StockLevelQuery, orgId: string) {
  const { page, limit, warehouse_id, variant_id, search, below_minimum, expired, expiring_within_days } = query
  const { offset } = paginate(page, limit)

  const andParts: object[] = [{ org_id: orgId }]
  if (warehouse_id) andParts.push({ warehouse_id })
  if (variant_id) andParts.push({ variant_id })
  if (search) {
    const like = `%${search}%`
    andParts.push({
      [Op.or as unknown as string]: [
        { '$variant.sku$':          { [Op.iLike]: like } },
        { '$variant.name$':         { [Op.iLike]: like } },
        { '$variant.product.name$': { [Op.iLike]: like } },
      ],
    })
  }
  if (below_minimum) {
    andParts.push(
      literal(
        '("StockItem"."minimum_quantity" > 0 AND "StockItem"."quantity" <= "StockItem"."minimum_quantity")',
      ),
    )
  }
  if (expired) {
    andParts.push(
      literal(
        '("StockItem"."expires_on" IS NOT NULL AND "StockItem"."expires_on" < CURRENT_DATE)',
      ),
    )
  }
  if (expiring_within_days != null) {
    const days = Number(expiring_within_days)
    andParts.push(
      literal(
        `("StockItem"."expires_on" IS NOT NULL AND "StockItem"."expires_on" >= CURRENT_DATE AND "StockItem"."expires_on" <= CURRENT_DATE + (${days} * INTERVAL '1 day'))`,
      ),
    )
  }

  const where = { [Op.and]: andParts }

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

function assertWarehouseBranchAllowed(ctx: TenantContext, warehouseBranchId: string | null) {
  if (ctx.allowedBranchIds.length === 0) return
  if (!warehouseBranchId || !ctx.allowedBranchIds.includes(warehouseBranchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
}

export async function updateStockItemAlerts(ctx: TenantContext, input: StockItemAlertsPatchInput): Promise<void> {
  const warehouse = await getWarehouse(input.warehouse_id, ctx.orgId)
  assertWarehouseBranchAllowed(ctx, warehouse.branch_id)

  const variant = await ProductVariant.findOne({
    where: { id: input.variant_id, org_id: ctx.orgId },
    attributes: ['id'],
  })
  if (!variant) throw new Error('VARIANT_NOT_FOUND')

  const minQty = new Decimal(input.minimum_quantity).toFixed(4)

  await sequelize.transaction(async (t) => {
    const [item] = await StockItem.findOrCreate({
      where:    { variant_id: input.variant_id, warehouse_id: input.warehouse_id },
      defaults: {
        variant_id:       input.variant_id,
        warehouse_id:     input.warehouse_id,
        org_id:           ctx.orgId,
        quantity:         '0',
        minimum_quantity: '0',
        expires_on:       null,
      },
      transaction: t,
      lock: true,
    })

    await item.update(
      {
        minimum_quantity: minQty,
        expires_on:       input.expires_on,
      },
      { transaction: t },
    )
  })
}

export async function getVariantStock(variantId: string, warehouseId: string): Promise<string> {
  const item = await StockItem.findOne({ where: { variant_id: variantId, warehouse_id: warehouseId } })
  return item?.quantity ?? '0'
}
