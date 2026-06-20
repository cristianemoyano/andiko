import type { OrgIvaCondition } from '@/modules/auth/organization.model'
import type { IvaCondition } from '@/modules/contacts/contact.model'
import {
  CBTE_TIPO_BY_KIND,
  type CbteTipo,
  type ComprobanteKind,
  type ComprobanteLetra,
} from './afip-codes'

export type ClassifiedComprobante = {
  letra: ComprobanteLetra
  cbteTipo: CbteTipo
}

export class ComprobanteClassificationError extends Error {
  readonly code = 'AFIP_ISSUER_NOT_ELECTRONIC' as const
  constructor(condition: OrgIvaCondition | null) {
    super(`Issuer IVA condition '${condition ?? 'null'}' cannot emit electronic comprobantes`)
    this.name = 'ComprobanteClassificationError'
  }
}

/**
 * Determines the fiscal letter (A/B/C) and AFIP CbteTipo for a comprobante,
 * from the issuer's (organization) and receiver's (contact) IVA conditions.
 *
 * Rules (RG 1415 / monotributo regime):
 *  - Monotributista issuer  → always letter C.
 *  - Responsable inscripto issuer:
 *      · receiver responsable inscripto → letter A
 *      · any other receiver             → letter B
 *  - Exento / no_responsable / consumidor_final issuers cannot emit electronically.
 */
export function classifyComprobante(
  issuer: OrgIvaCondition | null,
  receiver: IvaCondition,
  kind: ComprobanteKind,
): ClassifiedComprobante {
  const letra = resolveLetra(issuer, receiver)
  return { letra, cbteTipo: CBTE_TIPO_BY_KIND[kind][letra] }
}

function resolveLetra(issuer: OrgIvaCondition | null, receiver: IvaCondition): ComprobanteLetra {
  switch (issuer) {
    case 'monotributista':
      return 'C'
    case 'responsable_inscripto':
      return receiver === 'responsable_inscripto' ? 'A' : 'B'
    default:
      throw new ComprobanteClassificationError(issuer)
  }
}
