/** Sequelize fields required to pick fiscal vs internal display number. */
export const FISCAL_NUMBER_SOURCE_ATTRS = ['afip_status', 'punto_venta', 'cbte_numero'] as const

export interface FiscalDocumentRefs {
  internalNumber: string
  afip_status?: string | null
  punto_venta?: number | null
  cbte_numero?: number | null
}

export function formatAfipComprobanteNumber(
  puntoVenta: number | null | undefined,
  cbteNumero: number | null | undefined,
): string | null {
  if (puntoVenta == null || cbteNumero == null) return null
  return `${String(puntoVenta).padStart(4, '0')}-${String(cbteNumero).padStart(8, '0')}`
}

export function isAfipAuthorizedFiscalNumber(refs: FiscalDocumentRefs): boolean {
  return refs.afip_status === 'authorized'
    && formatAfipComprobanteNumber(refs.punto_venta, refs.cbte_numero) != null
}

/** Primary number shown to users: AFIP when authorized, internal otherwise. */
export function resolveSalesDocumentDisplay(refs: FiscalDocumentRefs): {
  primary: string
  internal: string
  isFiscalNumber: boolean
} {
  const afipNumber = formatAfipComprobanteNumber(refs.punto_venta, refs.cbte_numero)
  const isFiscalNumber = refs.afip_status === 'authorized' && afipNumber != null
  return {
    primary: isFiscalNumber ? afipNumber : refs.internalNumber,
    internal: refs.internalNumber,
    isFiscalNumber,
  }
}
