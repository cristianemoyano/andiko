import { classifyComprobante } from './comprobante-classifier'
import { resolveDocTipo } from './doctipo'
import { aggregateIva, type AfipLineItem, type AfipIvaAlicuota } from './iva-aggregation'
import {
  CONCEPTO,
  CONDICION_IVA_BY_CONDITION,
  MONEDA_PESOS,
  type CbteTipo,
  type CondicionIvaReceptorId,
  type ComprobanteKind,
  type ComprobanteLetra,
  type DocTipo,
} from './afip-codes'
import type { OrgIvaCondition } from '@/modules/auth/organization.model'
import type { IvaCondition } from '@/modules/contacts/contact.model'

export type AfipAssociatedComprobante = {
  cbteTipo: CbteTipo
  puntoVenta: number
  cbteNumero: number
}

export type AfipDocumentInput = {
  kind: ComprobanteKind
  issueDate: Date | string
  items: AfipLineItem[]
  /** Required for credit/debit notes: the comprobante they reference. */
  associated?: AfipAssociatedComprobante | null
}

/** Normalized FECAESolicitar request — the transport adapter maps this to the SDK shape. */
export type FECAERequest = {
  cbteTipo: CbteTipo
  letra: ComprobanteLetra
  concepto: number
  docTipo: DocTipo
  docNro: number
  condicionIvaReceptorId: CondicionIvaReceptorId
  puntoVenta: number
  cbteDesde: number
  cbteHasta: number
  /** AFIP date format yyyymmdd. */
  cbteFch: string
  impTotal: string
  impTotConc: string
  impNeto: string
  impOpEx: string
  impIVA: string
  impTrib: string
  monId: string
  monCotiz: number
  iva: AfipIvaAlicuota[]
  cbtesAsoc: AfipAssociatedComprobante[]
}

export type BuildFECAEParams = {
  org: { iva_condition: OrgIvaCondition | null }
  contact: { iva_condition: IvaCondition; cuit: string | null }
  doc: AfipDocumentInput
  puntoVenta: number
  cbteNumero: number
}

/** Builds the normalized FECAESolicitar request for a single comprobante. */
export function buildFECAERequest(params: BuildFECAEParams): FECAERequest {
  const { org, contact, doc, puntoVenta, cbteNumero } = params

  const { letra, cbteTipo } = classifyComprobante(org.iva_condition, contact.iva_condition, doc.kind)
  const { docTipo, docNro } = resolveDocTipo(contact)
  const totals = aggregateIva(doc.items)

  // Letter C (monotributista) does not discriminate IVA: the full amount is net,
  // ImpIVA is 0 and no Iva alícuota array is sent.
  const isC = letra === 'C'

  return {
    cbteTipo,
    letra,
    concepto: CONCEPTO.PRODUCTOS,
    docTipo,
    docNro,
    condicionIvaReceptorId: CONDICION_IVA_BY_CONDITION[contact.iva_condition],
    puntoVenta,
    cbteDesde: cbteNumero,
    cbteHasta: cbteNumero,
    cbteFch: formatAfipDate(doc.issueDate),
    impTotal: totals.impTotal,
    impTotConc: '0.00',
    impNeto: isC ? totals.impTotal : totals.impNeto,
    impOpEx: '0.00',
    impIVA: isC ? '0.00' : totals.impIVA,
    impTrib: '0.00',
    monId: MONEDA_PESOS,
    monCotiz: 1,
    iva: isC ? [] : totals.iva,
    cbtesAsoc: doc.associated ? [doc.associated] : [],
  }
}

/** Formats a date as AFIP's `yyyymmdd` string (UTC-safe). Accepts Date or ISO/date-only strings from Sequelize. */
export function formatAfipDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) throw new Error('INVALID_AFIP_DATE')
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Converts an AFIP `yyyymmdd` string to an ISO `yyyy-mm-dd` date string. */
export function parseAfipDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
