import 'server-only'
import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'

/**
 * Siguiente número de orden de producción por organización + sucursal.
 * Formato: `OP-{branch_code 2 dígitos}-{secuencia 4 dígitos}` (ej. `OP-01-0001`).
 * Reutiliza la tabla genérica `document_sequences` (mismo mecanismo que Compras).
 */
export async function nextProductionOrderNumber(
  orgId: string,
  branchId: string,
  t: Transaction,
): Promise<string> {
  if (!orgId || !branchId) {
    throw new Error('ORG_CONTEXT_REQUIRED')
  }

  const { default: Branch } = await import('@/modules/auth/branch.model')
  const branch = await Branch.findOne({
    where: { id: branchId, org_id: orgId, is_active: true },
    attributes: ['branch_code'],
    transaction: t,
  })
  if (!branch) {
    throw new Error('BRANCH_NOT_FOUND')
  }

  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO document_sequences (org_id, branch_id, document_type, last_number)
     VALUES (:orgId, :branchId, 'production_order', 1)
     ON CONFLICT (org_id, branch_id, document_type)
     DO UPDATE SET last_number = document_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId, branchId }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  const bc = String(branch.branch_code).padStart(2, '0')
  return `OP-${bc}-${String(num).padStart(4, '0')}`
}

export interface BomRollupComponent {
  quantity: string
  scrap_pct: string
  cost_price: string | null
}

/**
 * Costo por unidad de producto terminado según la BOM: suma de
 * (cantidad × (1 + merma%) × costo del componente), prorrateado por `output_quantity`.
 * Componentes sin `cost_price` cargado se toman como costo 0 (no bloquea el cálculo).
 */
export function computeBomRollupCost(components: BomRollupComponent[], outputQuantity: string): Decimal {
  const total = components.reduce((acc, c) => {
    const qty      = new Decimal(c.quantity)
    const scrap    = new Decimal(c.scrap_pct).div(100)
    const cost     = new Decimal(c.cost_price ?? '0')
    const effectiveQty = qty.mul(new Decimal(1).plus(scrap))
    return acc.plus(effectiveQty.mul(cost))
  }, new Decimal(0))

  const output = new Decimal(outputQuantity)
  if (output.lte(0)) return total
  return total.div(output)
}
