import 'server-only'
import { readFileSync } from 'node:fs'
import { Arca } from '@ramiidv/arca-facturacion'
import type { InvoiceDetail, InvoiceRequest } from '@ramiidv/arca-facturacion'
import { env } from '@/config/env'
import logger from '@/lib/logger'
import { FE_RESULT } from './afip-codes'
import type { FECAERequest } from './wsfe-payload'
import { type WsfeClient, type SolicitarCAEResult, type AfipQRInput } from './wsfe.client'

/**
 * Real WSFE transport backed by `@ramiidv/arca-facturacion`. WSAA auth, CMS
 * signing and token caching are handled inside the SDK's `Arca` instance using
 * the certificate/key configured via env. Never imported in `stub` mode or tests.
 */
export class ArcaWsfeClient implements WsfeClient {
  private readonly arca: Arca

  constructor() {
    if (!env.AFIP_CUIT || !env.AFIP_CERT_PATH || !env.AFIP_KEY_PATH) {
      throw new Error('AFIP_CERT_NOT_CONFIGURED')
    }
    this.arca = new Arca({
      cuit: Number(env.AFIP_CUIT),
      cert: readFileSync(env.AFIP_CERT_PATH, 'utf-8'),
      key: readFileSync(env.AFIP_KEY_PATH, 'utf-8'),
      production: env.AFIP_MODE === 'produccion',
      onEvent: (e) => logger.debug({ afipEvent: e }, 'arca sdk event'),
    })
  }

  async consultarUltimoAutorizado(puntoVenta: number, cbteTipo: number): Promise<number> {
    return this.arca.ultimoComprobante(puntoVenta, cbteTipo)
  }

  async solicitarCAE(req: FECAERequest): Promise<SolicitarCAEResult> {
    const request: InvoiceRequest = {
      PtoVta: req.puntoVenta,
      CbteTipo: req.cbteTipo,
      invoices: [this.toInvoiceDetail(req)],
    }
    const result = await this.arca.crearFactura(request)
    const extracted = Arca.extractCAE(result)
    const detail = extracted.details[0]

    return {
      resultado: extracted.approved ? FE_RESULT.APROBADO : FE_RESULT.RECHAZADO,
      cae: extracted.cae ?? null,
      caeVto: extracted.caeFchVto ?? null,
      cbteNumero: req.cbteDesde,
      observations: collectObservations(detail?.Observaciones?.Obs, result.Errors?.Err),
    }
  }

  generateQR(input: AfipQRInput): string {
    return Arca.generateQRUrl({ ...input, tipoCodAut: 'E' })
  }

  private toInvoiceDetail(req: FECAERequest): InvoiceDetail {
    return {
      Concepto: req.concepto,
      DocTipo: req.docTipo,
      DocNro: req.docNro,
      CondicionIVAReceptorId: req.condicionIvaReceptorId,
      CbteDesde: req.cbteDesde,
      CbteHasta: req.cbteHasta,
      CbteFch: req.cbteFch,
      ImpTotal: Number(req.impTotal),
      ImpTotConc: Number(req.impTotConc),
      ImpNeto: Number(req.impNeto),
      ImpOpEx: Number(req.impOpEx),
      ImpTrib: Number(req.impTrib),
      ImpIVA: Number(req.impIVA),
      MonId: req.monId,
      MonCotiz: req.monCotiz,
      Iva: req.iva.map((a) => ({ Id: a.Id, BaseImp: Number(a.BaseImp), Importe: Number(a.Importe) })),
      CbtesAsoc: req.cbtesAsoc.map((c) => ({ Tipo: c.cbteTipo, PtoVta: c.puntoVenta, Nro: c.cbteNumero })),
    }
  }
}

type SdkObs = { Code: number; Msg: string }

function collectObservations(
  obs: SdkObs | SdkObs[] | undefined,
  errs: SdkObs | SdkObs[] | undefined,
): { code: number; msg: string }[] {
  const all = [...toArray(obs), ...toArray(errs)]
  return all.map((o) => ({ code: o.Code, msg: o.Msg }))
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
