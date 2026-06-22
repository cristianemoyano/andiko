import 'server-only'
import { Op, QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'
import Invoice from '@/modules/sales/invoice.model'
import type { CbteTipo } from '@/modules/afip/afip-codes'
import { isAfipCbteUniqueViolation } from '@/modules/pos/pos-afip-sequence.utils'

export { isAfipCbteUniqueViolation }

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
                   AND cbte_numero IS NOT NULL AND deleted_at IS NULL), 0)
     ) AS max_num`,
    {
      replacements: { orgId, pv: puntoVenta, tipo: cbteTipo },
      type: QueryTypes.SELECT,
    },
  )
  return Number(rows[0]?.max_num ?? 0)
}
export async function afipCbteUsedByOtherInvoice(
  orgId: string,
  puntoVenta: number,
  comprobanteTipo: number,
  cbteNumero: number,
  excludeOrderId: string,
): Promise<boolean> {
  const conflicting = await Invoice.findOne({
    where: {
      org_id: orgId,
      punto_venta: puntoVenta,
      comprobante_tipo: comprobanteTipo,
      cbte_numero: cbteNumero,
      order_id: { [Op.ne]: excludeOrderId },
    },
    attributes: ['id'],
  })
  return conflicting !== null
}
