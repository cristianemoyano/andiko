import 'server-only'
import { Op, type Transaction } from 'sequelize'
import Product from '@/modules/catalog/product.model'
import type { ProductType } from '@/modules/catalog/product.model'
import type SalesOrderItem from './sales-order-item.model'
import type { ShipmentLineRef } from './shippable-order-lines'

export async function loadProductTypesById(
  productIds: string[],
  orgId: string,
  transaction?: Transaction,
): Promise<Map<string, ProductType>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const products = await Product.findAll({
    where: { id: { [Op.in]: uniqueIds }, org_id: orgId },
    attributes: ['id', 'product_type'],
    transaction,
  })
  return new Map(products.map(product => [product.id, product.product_type]))
}

export function orderItemsToShipmentLineRefs(
  orderItems: Array<Pick<SalesOrderItem, 'quantity' | 'shipped_qty' | 'product_id'>>,
  typeByProductId: Map<string, ProductType>,
): ShipmentLineRef[] {
  return orderItems.map(item => ({
    quantity: item.quantity,
    shipped_qty: item.shipped_qty,
    product_type: item.product_id ? typeByProductId.get(item.product_id) ?? null : null,
  }))
}

export function assertOrderItemIsShippable(
  orderItem: Pick<SalesOrderItem, 'product_id'>,
  typeByProductId: Map<string, ProductType>,
): void {
  if (!orderItem.product_id) return
  if (typeByProductId.get(orderItem.product_id) === 'service') {
    throw new Error('ORDER_ITEM_NOT_SHIPPABLE')
  }
}
