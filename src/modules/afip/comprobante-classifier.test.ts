import { describe, it, expect } from 'vitest'
import { classifyComprobante, ComprobanteClassificationError } from './comprobante-classifier'
import { CBTE_TIPO } from './afip-codes'

describe('classifyComprobante', () => {
  it('RI issuer → RI receiver = Factura A', () => {
    const r = classifyComprobante('responsable_inscripto', 'responsable_inscripto', 'invoice')
    expect(r).toEqual({ letra: 'A', cbteTipo: CBTE_TIPO.FACTURA_A })
  })

  it.each(['consumidor_final', 'monotributista', 'exento', 'no_responsable'] as const)(
    'RI issuer → %s receiver = Factura B',
    (receiver) => {
      const r = classifyComprobante('responsable_inscripto', receiver, 'invoice')
      expect(r).toEqual({ letra: 'B', cbteTipo: CBTE_TIPO.FACTURA_B })
    },
  )

  it.each(['responsable_inscripto', 'consumidor_final', 'monotributista'] as const)(
    'Monotributista issuer → %s receiver = Factura C',
    (receiver) => {
      const r = classifyComprobante('monotributista', receiver, 'invoice')
      expect(r).toEqual({ letra: 'C', cbteTipo: CBTE_TIPO.FACTURA_C })
    },
  )

  it('maps credit note kinds to the correct CbteTipo', () => {
    expect(classifyComprobante('responsable_inscripto', 'responsable_inscripto', 'credit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_CREDITO_A)
    expect(classifyComprobante('responsable_inscripto', 'consumidor_final', 'credit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_CREDITO_B)
    expect(classifyComprobante('monotributista', 'consumidor_final', 'credit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_CREDITO_C)
  })

  it('maps debit note kinds to the correct CbteTipo', () => {
    expect(classifyComprobante('responsable_inscripto', 'responsable_inscripto', 'debit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_DEBITO_A)
    expect(classifyComprobante('responsable_inscripto', 'consumidor_final', 'debit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_DEBITO_B)
    expect(classifyComprobante('monotributista', 'consumidor_final', 'debit_note').cbteTipo).toBe(CBTE_TIPO.NOTA_DEBITO_C)
  })

  it.each(['consumidor_final', 'exento', 'no_responsable', null] as const)(
    'throws when issuer %s cannot emit electronically',
    (issuer) => {
      expect(() => classifyComprobante(issuer, 'consumidor_final', 'invoice')).toThrow(ComprobanteClassificationError)
    },
  )
})
