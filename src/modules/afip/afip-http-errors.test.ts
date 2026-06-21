import { describe, expect, it } from 'vitest'
import { ComprobanteClassificationError } from './comprobante-classifier'
import { resolveAfipError } from './afip-http-errors'

describe('resolveAfipError', () => {
  it('maps errors thrown with message as the code', () => {
    expect(resolveAfipError(new Error('AFIP_PUNTO_VENTA_REQUIRED'))).toEqual({
      code: 'AFIP_PUNTO_VENTA_REQUIRED',
      message: 'La sucursal no tiene punto de venta AFIP configurado',
      status: 422,
    })
  })

  it('maps errors that expose a separate code property', () => {
    const err = new ComprobanteClassificationError(null)
    expect(resolveAfipError(err)).toEqual({
      code: 'AFIP_ISSUER_NOT_ELECTRONIC',
      message:
        'Configurá la condición de IVA de tu empresa (emisor), no la del cliente, en Configuración → AFIP → Datos fiscales',
      status: 422,
    })
  })

  it('returns null for unmapped errors', () => {
    expect(resolveAfipError(new Error('something else'))).toBeNull()
  })
})
