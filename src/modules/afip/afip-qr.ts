/**
 * AFIP/ARCA QR per RG 4291: a URL `https://www.afip.gob.ar/fe/qr/?p=<base64 JSON>`
 * encoding the authorized comprobante. Pure and deterministic — derived from the
 * stored comprobante data, independent of the WSFE transport.
 */

export interface AfipQrInput {
  /** Comprobante date as `yyyy-mm-dd`. */
  fecha: string
  /** Issuer CUIT (digits only). */
  cuit: number
  ptoVta: number
  /** AFIP CbteTipo. */
  tipoCmp: number
  nroCmp: number
  importe: number
  moneda: string
  ctz: number
  tipoDocRec: number
  nroDocRec: number
  /** CAE as a number. */
  codAut: number
}

export const AFIP_QR_BASE_URL = 'https://www.afip.gob.ar/fe/qr/'

export function buildAfipQrUrl(input: AfipQrInput): string {
  // Field order follows the RG 4291 specification.
  const payload = {
    ver: 1,
    fecha: input.fecha,
    cuit: input.cuit,
    ptoVta: input.ptoVta,
    tipoCmp: input.tipoCmp,
    nroCmp: input.nroCmp,
    importe: input.importe,
    moneda: input.moneda,
    ctz: input.ctz,
    tipoDocRec: input.tipoDocRec,
    nroDocRec: input.nroDocRec,
    tipoCodAut: 'E',
    codAut: input.codAut,
  }
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return `${AFIP_QR_BASE_URL}?p=${base64}`
}
