import type { IvaRate } from '@/types'

/**
 * AFIP/ARCA domain code tables. Every code AFIP expects on the wire is defined
 * here as a named constant — no magic numbers anywhere else in the module.
 *
 * References: RG 4291 (QR), WSFEv1 manual (CbteTipo, DocTipo, AlicIva, Concepto).
 */

// ── Comprobante types (CbteTipo) ────────────────────────────────────────────
export const CBTE_TIPO = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  FACTURA_C: 11,
  NOTA_DEBITO_A: 2,
  NOTA_DEBITO_B: 7,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_A: 3,
  NOTA_CREDITO_B: 8,
  NOTA_CREDITO_C: 13,
} as const

export type CbteTipo = (typeof CBTE_TIPO)[keyof typeof CBTE_TIPO]

export type ComprobanteLetra = 'A' | 'B' | 'C'
export type ComprobanteKind = 'invoice' | 'credit_note' | 'debit_note'

/** CbteTipo lookup by (kind, letra). */
export const CBTE_TIPO_BY_KIND: Record<ComprobanteKind, Record<ComprobanteLetra, CbteTipo>> = {
  invoice: {
    A: CBTE_TIPO.FACTURA_A,
    B: CBTE_TIPO.FACTURA_B,
    C: CBTE_TIPO.FACTURA_C,
  },
  debit_note: {
    A: CBTE_TIPO.NOTA_DEBITO_A,
    B: CBTE_TIPO.NOTA_DEBITO_B,
    C: CBTE_TIPO.NOTA_DEBITO_C,
  },
  credit_note: {
    A: CBTE_TIPO.NOTA_CREDITO_A,
    B: CBTE_TIPO.NOTA_CREDITO_B,
    C: CBTE_TIPO.NOTA_CREDITO_C,
  },
}

// ── Document types (DocTipo) ─────────────────────────────────────────────────
export const DOC_TIPO = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const

export type DocTipo = (typeof DOC_TIPO)[keyof typeof DOC_TIPO]

// ── IVA rate codes (AlicIva.Id) ──────────────────────────────────────────────
export const ALIC_IVA = {
  RATE_0: 3,
  RATE_10_5: 4,
  RATE_21: 5,
  RATE_27: 6,
} as const

export type AlicIvaId = (typeof ALIC_IVA)[keyof typeof ALIC_IVA]

/** Maps the app's `IvaRate` (percentage string) to the AFIP AlicIva.Id code. */
export const ALIC_IVA_BY_RATE: Record<IvaRate, AlicIvaId> = {
  '0': ALIC_IVA.RATE_0,
  '10.5': ALIC_IVA.RATE_10_5,
  '21': ALIC_IVA.RATE_21,
  '27': ALIC_IVA.RATE_27,
}

// ── Condición IVA del receptor (mandatory on FECAESolicitar since Apr 2026) ──
export const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTISTA: 6,
  NO_CATEGORIZADO: 7,
} as const

export type CondicionIvaReceptorId =
  (typeof CONDICION_IVA_RECEPTOR)[keyof typeof CONDICION_IVA_RECEPTOR]

/** Maps the app's contact/org IVA condition string to the AFIP receptor code. */
export const CONDICION_IVA_BY_CONDITION: Record<string, CondicionIvaReceptorId> = {
  responsable_inscripto: CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO,
  exento: CONDICION_IVA_RECEPTOR.EXENTO,
  consumidor_final: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
  monotributista: CONDICION_IVA_RECEPTOR.MONOTRIBUTISTA,
  no_responsable: CONDICION_IVA_RECEPTOR.NO_CATEGORIZADO,
}

// ── Concepto (1=Productos, 2=Servicios, 3=Productos y Servicios) ──────────────
export const CONCEPTO = {
  PRODUCTOS: 1,
  SERVICIOS: 2,
  PRODUCTOS_Y_SERVICIOS: 3,
} as const

export type Concepto = (typeof CONCEPTO)[keyof typeof CONCEPTO]

// ── WSFE result codes ────────────────────────────────────────────────────────
export const FE_RESULT = {
  APROBADO: 'A',
  RECHAZADO: 'R',
  PARCIAL: 'P',
} as const

export type FeResult = (typeof FE_RESULT)[keyof typeof FE_RESULT]

// ── Moneda ───────────────────────────────────────────────────────────────────
export const MONEDA_PESOS = 'PES'

// ── Environments ─────────────────────────────────────────────────────────────
export const AFIP_ENVIRONMENTS = ['stub', 'homologacion', 'produccion'] as const
export type AfipEnvironment = (typeof AFIP_ENVIRONMENTS)[number]

// ── Per-document AFIP transmission status ────────────────────────────────────
export const AFIP_DOC_STATUSES = [
  'not_sent',
  'pending',
  'authorized',
  'rejected',
  'contingency',
] as const
export type AfipDocStatus = (typeof AFIP_DOC_STATUSES)[number]

/** A WSFE observation/error (code + message), persisted on documents and the queue. */
export type AfipObservation = { code: number; msg: string }
