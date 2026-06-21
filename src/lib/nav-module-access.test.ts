import { describe, it, expect } from 'vitest'
import { hasModuleReadAccess, isModuleNavVisible } from './nav-module-access'

const ALL_ORG_MODULES = ['contacts', 'catalog', 'sales', 'inventory', 'purchases', 'accounting', 'pos'] as const

describe('nav-module-access', () => {
  const depositoPerms = ['inventory:read', 'inventory:write', 'products:read']

  it('depósito can access inventario and catálogo only', () => {
    expect(hasModuleReadAccess('inventory', depositoPerms)).toBe(true)
    expect(hasModuleReadAccess('catalog', depositoPerms)).toBe(true)
    expect(hasModuleReadAccess('sales', depositoPerms)).toBe(false)
    expect(hasModuleReadAccess('contacts', depositoPerms)).toBe(false)
  })

  it('hides ventas for depósito when org has all modules enabled', () => {
    expect(
      isModuleNavVisible('ventas', [...ALL_ORG_MODULES], depositoPerms),
    ).toBe(false)
    expect(
      isModuleNavVisible('inventario', [...ALL_ORG_MODULES], depositoPerms),
    ).toBe(true)
  })

  it('hides module nav until permissions are loaded', () => {
    expect(isModuleNavVisible('ventas', [...ALL_ORG_MODULES], undefined)).toBe(false)
  })

  it('shows module when org plan excludes it', () => {
    const basePlan = ['contacts', 'catalog', 'sales'] as const
    expect(isModuleNavVisible('inventario', [...basePlan], depositoPerms)).toBe(false)
  })
})
