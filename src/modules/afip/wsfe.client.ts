import { FE_RESULT, type AfipObservation, type CbteTipo, type FeResult } from './afip-codes'
import type { FECAERequest } from './wsfe-payload'

export type WsObservation = AfipObservation

/**
 * WSFE (electronic invoicing) transport boundary.
 *
 * Services depend only on the `WsfeClient` interface. The real implementation
 * (`arca-clients.ts`) wraps `@ramiidv/arca-facturacion`; `StubWsfeClient` returns
 * deterministic synthetic CAEs for tests and `AFIP_MODE=stub` — no cert/network.
 */

export type SolicitarCAEResult = {
  resultado: FeResult
  cae: string | null
  /** CAE expiration in AFIP `yyyymmdd` format. */
  caeVto: string | null
  cbteNumero: number
  observations: WsObservation[]
}

export type AfipQRInput = {
  /** Comprobante date as `yyyy-mm-dd`. */
  fecha: string
  cuit: number
  ptoVta: number
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

export interface WsfeClient {
  /** Last authorized comprobante number for a (punto de venta, tipo). 0 when none. */
  consultarUltimoAutorizado(puntoVenta: number, cbteTipo: CbteTipo): Promise<number>
  solicitarCAE(req: FECAERequest): Promise<SolicitarCAEResult>
  generateQR(input: AfipQRInput): string
}

/**
 * Deterministic in-memory stub. Tracks the last authorized number per
 * (punto de venta, tipo) so sequential issuance behaves realistically.
 */
export class StubWsfeClient implements WsfeClient {
  private readonly lastByKey = new Map<string, number>()

  private key(pv: number, cbteTipo: number): string {
    return `${pv}-${cbteTipo}`
  }

  async consultarUltimoAutorizado(puntoVenta: number, cbteTipo: CbteTipo): Promise<number> {
    return this.lastByKey.get(this.key(puntoVenta, cbteTipo)) ?? 0
  }

  async solicitarCAE(req: FECAERequest): Promise<SolicitarCAEResult> {
    this.lastByKey.set(this.key(req.puntoVenta, req.cbteTipo), req.cbteDesde)
    const cae = String(70000000000000 + req.cbteDesde).slice(0, 14)
    return {
      resultado: FE_RESULT.APROBADO,
      cae,
      caeVto: addDays(req.cbteFch, 10),
      cbteNumero: req.cbteDesde,
      observations: [],
    }
  }

  generateQR(input: AfipQRInput): string {
    return `https://www.afip.gob.ar/fe/qr/?p=stub-${input.ptoVta}-${input.tipoCmp}-${input.nroCmp}`
  }
}

/** Adds whole days to an AFIP `yyyymmdd` date string, returning `yyyymmdd`. */
function addDays(yyyymmdd: string, days: number): string {
  const y = Number(yyyymmdd.slice(0, 4))
  const m = Number(yyyymmdd.slice(4, 6))
  const d = Number(yyyymmdd.slice(6, 8))
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}
