import { describe, expect, it } from 'vitest'
import { resolveModuleForPath } from './organization-modules'

describe('resolveModuleForPath', () => {
  it('maps all contabilidad routes including fiscal to accounting', () => {
    expect(resolveModuleForPath('/contabilidad/asientos')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/plan-de-cuentas')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/balance')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/libro-iva/ventas')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/libro-iva/compras')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/reportes/ventas')).toBe('accounting')
    expect(resolveModuleForPath('/contabilidad/reportes/compras')).toBe('accounting')
  })

  it('maps legacy ventas/compras fiscal routes to accounting', () => {
    expect(resolveModuleForPath('/ventas/libro-iva')).toBe('accounting')
    expect(resolveModuleForPath('/compras/libro-iva')).toBe('accounting')
    expect(resolveModuleForPath('/ventas/reportes')).toBe('accounting')
    expect(resolveModuleForPath('/compras/reportes')).toBe('accounting')
  })

  it('maps operational ventas/compras routes to sales/purchases', () => {
    expect(resolveModuleForPath('/ventas/facturas')).toBe('sales')
    expect(resolveModuleForPath('/compras/ordenes')).toBe('purchases')
  })
})
