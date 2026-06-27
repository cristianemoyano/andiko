import { describe, expect, it } from 'vitest'
import {
  formatAfipComprobanteNumber,
  isAfipAuthorizedFiscalNumber,
  resolveSalesDocumentDisplay,
} from './fiscal-document-number'

describe('formatAfipComprobanteNumber', () => {
  it('pads punto de venta and comprobante', () => {
    expect(formatAfipComprobanteNumber(2, 3)).toBe('0002-00000003')
  })

  it('returns null when parts are missing', () => {
    expect(formatAfipComprobanteNumber(null, 3)).toBeNull()
    expect(formatAfipComprobanteNumber(2, null)).toBeNull()
  })
})

describe('resolveSalesDocumentDisplay', () => {
  it('uses internal number when not authorized', () => {
    expect(resolveSalesDocumentDisplay({
      internalNumber: 'FAC-02-0008',
      afip_status: 'not_sent',
      punto_venta: 2,
      cbte_numero: 3,
    })).toEqual({
      primary: 'FAC-02-0008',
      internal: 'FAC-02-0008',
      isFiscalNumber: false,
    })
  })

  it('uses AFIP number when authorized', () => {
    expect(resolveSalesDocumentDisplay({
      internalNumber: 'FAC-02-0008',
      afip_status: 'authorized',
      punto_venta: 2,
      cbte_numero: 3,
    })).toEqual({
      primary: '0002-00000003',
      internal: 'FAC-02-0008',
      isFiscalNumber: true,
    })
  })
})

describe('isAfipAuthorizedFiscalNumber', () => {
  it('requires authorized status and both AFIP parts', () => {
    expect(isAfipAuthorizedFiscalNumber({
      internalNumber: 'FAC-02-0008',
      afip_status: 'authorized',
      punto_venta: 2,
      cbte_numero: 3,
    })).toBe(true)

    expect(isAfipAuthorizedFiscalNumber({
      internalNumber: 'FAC-02-0008',
      afip_status: 'authorized',
      punto_venta: null,
      cbte_numero: 3,
    })).toBe(false)
  })
})
