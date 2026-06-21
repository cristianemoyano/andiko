import { describe, it, expect } from 'vitest'
import { resolveDocTipo } from './doctipo'
import { DOC_TIPO } from './afip-codes'

describe('resolveDocTipo', () => {
  it('maps an 11-digit CUIT to DocTipo CUIT', () => {
    expect(resolveDocTipo({ cuit: '30712345670' })).toEqual({ docTipo: DOC_TIPO.CUIT, docNro: 30712345670 })
  })

  it('strips non-digits from a formatted CUIT', () => {
    expect(resolveDocTipo({ cuit: '30-71234567-0' })).toEqual({ docTipo: DOC_TIPO.CUIT, docNro: 30712345670 })
  })

  it('falls back to Consumidor Final when CUIT is missing', () => {
    expect(resolveDocTipo({ cuit: null })).toEqual({ docTipo: DOC_TIPO.CONSUMIDOR_FINAL, docNro: 0 })
  })

  it('falls back to Consumidor Final for an invalid-length CUIT', () => {
    expect(resolveDocTipo({ cuit: '123' })).toEqual({ docTipo: DOC_TIPO.CONSUMIDOR_FINAL, docNro: 0 })
  })
})
