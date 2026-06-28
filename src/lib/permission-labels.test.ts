import { describe, expect, it } from 'vitest'
import { permissionDisplayLabel, sortPermissionsForGroup } from './permission-labels'

describe('permissionDisplayLabel', () => {
  it('labels sales:scope_own for the matrix', () => {
    expect(permissionDisplayLabel('sales:scope_own')).toBe('Ventas · Solo propias')
  })

  it('labels standard module actions', () => {
    expect(permissionDisplayLabel('sales:read')).toBe('Ventas · Leer')
  })
})

describe('sortPermissionsForGroup', () => {
  it('orders sales permissions with scope_own last', () => {
    const perms = [
      { name: 'sales:scope_own' },
      { name: 'sales:delete' },
      { name: 'sales:read' },
      { name: 'sales:write' },
    ]
    expect(sortPermissionsForGroup('sales', perms).map(p => p.name)).toEqual([
      'sales:read',
      'sales:write',
      'sales:delete',
      'sales:scope_own',
    ])
  })
})
