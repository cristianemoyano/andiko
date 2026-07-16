import { describe, it, expect } from 'vitest'
import {
  SUSPENDIDO_PATH,
  isSuspensionExemptPath,
  shouldBlockSuspendedApiRequest,
} from './suspension-guard'

describe('SUSPENDIDO_PATH', () => {
  it('is /suspendido', () => {
    expect(SUSPENDIDO_PATH).toBe('/suspendido')
  })
})

describe('isSuspensionExemptPath', () => {
  it('exempts /suspendido and its subpaths', () => {
    expect(isSuspensionExemptPath('/suspendido')).toBe(true)
    expect(isSuspensionExemptPath('/suspendido/detalle')).toBe(true)
  })

  it('exempts /facturacion and its subpaths', () => {
    expect(isSuspensionExemptPath('/facturacion')).toBe(true)
    expect(isSuspensionExemptPath('/facturacion/facturas')).toBe(true)
    expect(isSuspensionExemptPath('/facturacion/facturas/abc-123')).toBe(true)
  })

  it('does not exempt lookalike prefixes', () => {
    expect(isSuspensionExemptPath('/facturacion-electronica')).toBe(false)
    expect(isSuspensionExemptPath('/suspendidos')).toBe(false)
  })

  it('does not exempt regular ERP paths', () => {
    expect(isSuspensionExemptPath('/panel')).toBe(false)
    expect(isSuspensionExemptPath('/ventas')).toBe(false)
    expect(isSuspensionExemptPath('/contactos/abc-123')).toBe(false)
    expect(isSuspensionExemptPath('')).toBe(false)
    expect(isSuspensionExemptPath('/')).toBe(false)
  })
})

describe('shouldBlockSuspendedApiRequest', () => {
  it('allows read methods', () => {
    expect(shouldBlockSuspendedApiRequest('GET')).toBe(false)
    expect(shouldBlockSuspendedApiRequest('HEAD')).toBe(false)
    expect(shouldBlockSuspendedApiRequest('OPTIONS')).toBe(false)
  })

  it('is case-insensitive for read methods', () => {
    expect(shouldBlockSuspendedApiRequest('get')).toBe(false)
    expect(shouldBlockSuspendedApiRequest('Head')).toBe(false)
    expect(shouldBlockSuspendedApiRequest('options')).toBe(false)
  })

  it('blocks mutating methods', () => {
    expect(shouldBlockSuspendedApiRequest('POST')).toBe(true)
    expect(shouldBlockSuspendedApiRequest('PATCH')).toBe(true)
    expect(shouldBlockSuspendedApiRequest('PUT')).toBe(true)
    expect(shouldBlockSuspendedApiRequest('DELETE')).toBe(true)
    expect(shouldBlockSuspendedApiRequest('post')).toBe(true)
  })
})
