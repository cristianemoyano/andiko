import 'server-only'
import { Op } from 'sequelize'
import Invoice from '@/modules/sales/invoice.model'
import {
  getMaxAuthorizedCbteNumero,
  resolveNextCbteNumero,
} from '@/modules/afip/afip-sequence.service'

export { isAfipCbteUniqueViolation } from '@/modules/afip/afip-sequence.utils'
export { getMaxAuthorizedCbteNumero, resolveNextCbteNumero }

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
