import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import StockItem from '@/modules/inventory/stock-item.model'
import { applyMovement } from '@/modules/inventory/stock-movements.service'

/** Depósito elegido en el import de catálogo (por transacción). */
const warehouseIdByTransaction = new WeakMap<Transaction, string | null>()

export function bindImportStockWarehouse(transaction: Transaction, warehouseId: string | null): void {
  warehouseIdByTransaction.set(transaction, warehouseId)
}

function resolveImportWarehouseId(transaction: Transaction): string | null {
  return warehouseIdByTransaction.get(transaction) ?? null
}

/**
 * Alinea el depósito indicado con el stock del CSV cuando la variante gestiona stock.
 * No sobrescribe cantidades ya cargadas en ese depósito (quantity > 0).
 */
export async function syncImportedStockToWarehouse(
  orgId: string,
  warehouseId: string,
  variantId: string,
  targetQuantity: number,
  actorId: string,
  transaction: Transaction,
): Promise<void> {
  const target = new Decimal(Math.max(0, targetQuantity))

  const [item] = await StockItem.findOrCreate({
    where:    { variant_id: variantId, warehouse_id: warehouseId },
    defaults: { variant_id: variantId, warehouse_id: warehouseId, org_id: orgId, quantity: '0' },
    transaction,
  })

  const current = new Decimal(item.quantity)
  if (current.gt(0)) return

  const delta = target.minus(current)
  if (delta.isZero()) return

  await applyMovement({
    variantId,
    warehouseId,
    orgId,
    movementType:  'adjustment',
    referenceType: 'initial',
    referenceId:   null,
    quantityDelta: delta,
    notes:         'Stock importado desde catálogo CSV',
    actorId,
  }, transaction)
}

/** Solo sincroniza si la variante gestiona stock y hay depósito elegido en el import. */
export async function syncImportedStockIfMapped(params: {
  orgId: string
  variantId: string
  manageStock: boolean
  stockQuantity: number | undefined
  actorId: string
  transaction: Transaction
}): Promise<void> {
  if (!params.manageStock) return

  const warehouseId = resolveImportWarehouseId(params.transaction)
  if (!warehouseId) return

  await syncImportedStockToWarehouse(
    params.orgId,
    warehouseId,
    params.variantId,
    params.stockQuantity ?? 0,
    params.actorId,
    params.transaction,
  )
}
