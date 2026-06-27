import 'server-only'
import { QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'
import type { CbteTipo } from './afip-codes'

/** Highest cbte_numero already stored locally for (org, PV, tipo). */
export async function getMaxAuthorizedCbteNumero(
  orgId: string,
  puntoVenta: number,
  cbteTipo: CbteTipo | number,
): Promise<number> {
  const rows = await sequelize.query<{ max_num: number | null }>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(cbte_numero) FROM sales_orders
                 WHERE org_id = :orgId AND punto_venta = :pv AND comprobante_tipo = :tipo
                   AND cbte_numero IS NOT NULL AND deleted_at IS NULL), 0),
       COALESCE((SELECT MAX(cbte_numero) FROM invoices
                 WHERE org_id = :orgId AND punto_venta = :pv AND comprobante_tipo = :tipo
                   AND cbte_numero IS NOT NULL AND deleted_at IS NULL), 0),
       COALESCE((SELECT MAX(cbte_numero) FROM credit_notes
                 WHERE org_id = :orgId AND punto_venta = :pv AND comprobante_tipo = :tipo
                   AND cbte_numero IS NOT NULL AND deleted_at IS NULL), 0),
       COALESCE((SELECT MAX(cbte_numero) FROM debit_notes
                 WHERE org_id = :orgId AND punto_venta = :pv AND comprobante_tipo = :tipo
                   AND cbte_numero IS NOT NULL AND deleted_at IS NULL), 0)
     ) AS max_num`,
    {
      replacements: { orgId, pv: puntoVenta, tipo: cbteTipo },
      type: QueryTypes.SELECT,
    },
  )
  return Number(rows[0]?.max_num ?? 0)
}

export async function resolveNextCbteNumero(
  orgId: string,
  wsfeUltimo: number,
  puntoVenta: number,
  cbteTipo: CbteTipo | number,
): Promise<number> {
  const fromDb = await getMaxAuthorizedCbteNumero(orgId, puntoVenta, cbteTipo)
  return Math.max(wsfeUltimo, fromDb) + 1
}
