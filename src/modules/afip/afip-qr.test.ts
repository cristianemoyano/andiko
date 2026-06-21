import { describe, it, expect } from 'vitest'
import { buildAfipQrUrl, AFIP_QR_BASE_URL } from './afip-qr'

const input = {
  fecha: '2026-06-20',
  cuit: 30111111118,
  ptoVta: 3,
  tipoCmp: 1,
  nroCmp: 42,
  importe: 1210.5,
  moneda: 'PES',
  ctz: 1,
  tipoDocRec: 80,
  nroDocRec: 30712345670,
  codAut: 70000000000123,
}

describe('buildAfipQrUrl', () => {
  it('builds the RG 4291 URL with a base64-encoded JSON payload', () => {
    const url = buildAfipQrUrl(input)
    expect(url.startsWith(`${AFIP_QR_BASE_URL}?p=`)).toBe(true)

    const base64 = url.split('?p=')[1]
    const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
    expect(decoded).toEqual({
      ver: 1,
      fecha: '2026-06-20',
      cuit: 30111111118,
      ptoVta: 3,
      tipoCmp: 1,
      nroCmp: 42,
      importe: 1210.5,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80,
      nroDocRec: 30712345670,
      tipoCodAut: 'E',
      codAut: 70000000000123,
    })
  })

  it('is deterministic for the same input', () => {
    expect(buildAfipQrUrl(input)).toBe(buildAfipQrUrl(input))
  })
})
