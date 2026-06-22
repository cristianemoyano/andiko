import { describe, it, expect } from 'vitest'
import { Op } from 'sequelize'
import { buildPosCashierUserWhere } from '@/lib/pos-cashier-eligibility'

describe('buildPosCashierUserWhere', () => {
  it('includes builtin admins and org roles with allows_pos', () => {
    const where = buildPosCashierUserWhere('org-1', ['role-cajero', 'role-vendedor'], 'branch-1')

    expect(where.org_id).toBe('org-1')
    expect(where.is_active).toBe(true)
    expect(where.branch_id).toEqual({ [Op.or]: ['branch-1', null] })
    expect(where[Op.or]).toEqual([
      { role: { [Op.in]: ['admin', 'branch-admin'] } },
      { org_role_id: { [Op.in]: ['role-cajero', 'role-vendedor'] } },
    ])
  })

  it('omits org_role filter when no POS roles exist', () => {
    const where = buildPosCashierUserWhere('org-1', [], null)
    expect(where[Op.or]).toEqual([{ role: { [Op.in]: ['admin', 'branch-admin'] } }])
    expect(where.branch_id).toBeUndefined()
  })
})
