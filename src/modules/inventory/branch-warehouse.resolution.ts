import 'server-only'
import type { Transaction } from 'sequelize'
import Warehouse from './warehouse.model'

export type BranchWarehouseResolutionCode =
  | 'BRANCH_ID_REQUIRED'
  | 'BRANCH_WAREHOUSE_NOT_CONFIGURED'
  | 'BRANCH_WAREHOUSE_AMBIGUOUS'

export class BranchWarehouseResolutionError extends Error {
  readonly code: BranchWarehouseResolutionCode

  constructor(code: BranchWarehouseResolutionCode, message: string) {
    super(message)
    this.name = 'BranchWarehouseResolutionError'
    this.code = code
  }
}

/**
 * Depósito de venta/stock de una sucursal: el único depósito activo con `branch_id` = sucursal.
 * Depósitos sin sucursal son centrales y solo participan vía transferencias u operaciones explícitas.
 */
export async function resolveWarehouseForBranch(
  branchId: string | null,
  orgId: string,
  transaction?: Transaction,
): Promise<string> {
  if (!branchId) {
    throw new BranchWarehouseResolutionError(
      'BRANCH_ID_REQUIRED',
      'La sucursal es requerida para resolver el depósito de stock.',
    )
  }

  const warehouses = await Warehouse.findAll({
    where: { org_id: orgId, branch_id: branchId, is_active: true },
    order: [['created_at', 'ASC']],
    attributes: ['id'],
    transaction,
  })

  if (warehouses.length === 0) {
    throw new BranchWarehouseResolutionError(
      'BRANCH_WAREHOUSE_NOT_CONFIGURED',
      'Esta sucursal no tiene un depósito asignado. En Inventario → Depósitos, vinculá un depósito activo a la sucursal.',
    )
  }

  if (warehouses.length > 1) {
    throw new BranchWarehouseResolutionError(
      'BRANCH_WAREHOUSE_AMBIGUOUS',
      'Esta sucursal tiene más de un depósito activo. Debe haber exactamente un depósito por sucursal.',
    )
  }

  return warehouses[0]!.id
}
