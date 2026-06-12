import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'

/**
 * Siguiente número de remito de entrega por organización + sucursal.
 * Reusa el mecanismo atómico de `document_sequences` (`ON CONFLICT DO UPDATE`).
 * Formato: `RTO-{branch_code 2 dígitos}-{secuencia 4 dígitos}` (ej. `RTO-01-0001`).
 *
 * Se usa el prefijo `RTO-` (no `REM-`/`REC-`) porque `REC-` ya está tomado por
 * las recepciones de compras y se evita cualquier colisión de prefijos.
 */
export async function nextDeliveryNumber(
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
     VALUES (:orgId, :branchId, 'delivery_note', 1)
     ON CONFLICT (org_id, branch_id, document_type)
     DO UPDATE SET last_number = document_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId, branchId }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  const bc = String(branch.branch_code).padStart(2, '0')
  return `RTO-${bc}-${String(num).padStart(4, '0')}`
}
