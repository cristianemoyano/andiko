import { describe, it, expect } from 'vitest'
import { buildFECAERequest, formatAfipDate, parseAfipDate } from './wsfe-payload'
import { CBTE_TIPO, DOC_TIPO, ALIC_IVA, CONDICION_IVA_RECEPTOR, MONEDA_PESOS } from './afip-codes'

const items = [{ iva_rate: '21' as const, tax_base: '1000.00', tax_amount: '210.00' }]

describe('buildFECAERequest', () => {
  it('builds a Factura A request for RI → RI', () => {
    const req = buildFECAERequest({
      org: { iva_condition: 'responsable_inscripto' },
      contact: { iva_condition: 'responsable_inscripto', cuit: '30712345670' },
      doc: { kind: 'invoice', issueDate: new Date(Date.UTC(2026, 5, 20)), items },
      puntoVenta: 3,
      cbteNumero: 42,
    })

    expect(req.cbteTipo).toBe(CBTE_TIPO.FACTURA_A)
    expect(req.letra).toBe('A')
    expect(req.docTipo).toBe(DOC_TIPO.CUIT)
    expect(req.docNro).toBe(30712345670)
    expect(req.condicionIvaReceptorId).toBe(CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO)
    expect(req.puntoVenta).toBe(3)
    expect(req.cbteDesde).toBe(42)
    expect(req.cbteHasta).toBe(42)
    expect(req.cbteFch).toBe('20260620')
    expect(req.impNeto).toBe('1000.00')
    expect(req.impIVA).toBe('210.00')
    expect(req.impTotal).toBe('1210.00')
    expect(req.monId).toBe(MONEDA_PESOS)
    expect(req.iva).toEqual([{ Id: ALIC_IVA.RATE_21, BaseImp: '1000.00', Importe: '210.00' }])
    expect(req.cbtesAsoc).toEqual([])
  })

  it('builds a Factura B for RI → consumidor final without CUIT', () => {
    const req = buildFECAERequest({
      org: { iva_condition: 'responsable_inscripto' },
      contact: { iva_condition: 'consumidor_final', cuit: null },
      doc: { kind: 'invoice', issueDate: new Date(Date.UTC(2026, 0, 1)), items },
      puntoVenta: 1,
      cbteNumero: 1,
    })
    expect(req.cbteTipo).toBe(CBTE_TIPO.FACTURA_B)
    expect(req.docTipo).toBe(DOC_TIPO.CONSUMIDOR_FINAL)
    expect(req.docNro).toBe(0)
  })

  it('does not discriminate IVA for monotributista (letter C)', () => {
    const req = buildFECAERequest({
      org: { iva_condition: 'monotributista' },
      contact: { iva_condition: 'consumidor_final', cuit: null },
      doc: { kind: 'invoice', issueDate: new Date(Date.UTC(2026, 5, 20)), items },
      puntoVenta: 1,
      cbteNumero: 5,
    })
    expect(req.letra).toBe('C')
    expect(req.iva).toEqual([])
    expect(req.impIVA).toBe('0.00')
    expect(req.impNeto).toBe('1210.00')
    expect(req.impTotal).toBe('1210.00')
  })

  it('includes the associated comprobante for a credit note', () => {
    const req = buildFECAERequest({
      org: { iva_condition: 'responsable_inscripto' },
      contact: { iva_condition: 'responsable_inscripto', cuit: '30712345670' },
      doc: {
        kind: 'credit_note',
        issueDate: new Date(Date.UTC(2026, 5, 20)),
        items,
        associated: { cbteTipo: CBTE_TIPO.FACTURA_A, puntoVenta: 3, cbteNumero: 42 },
      },
      puntoVenta: 3,
      cbteNumero: 7,
    })
    expect(req.cbteTipo).toBe(CBTE_TIPO.NOTA_CREDITO_A)
    expect(req.cbtesAsoc).toEqual([{ cbteTipo: CBTE_TIPO.FACTURA_A, puntoVenta: 3, cbteNumero: 42 }])
  })
})

describe('AFIP date helpers', () => {
  it('formats and parses round-trip', () => {
    expect(formatAfipDate(new Date(Date.UTC(2026, 5, 9)))).toBe('20260609')
    expect(parseAfipDate('20260609')).toBe('2026-06-09')
  })
})
