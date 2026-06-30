import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./warehouse.model', () => ({
  default: { findAll: vi.fn() },
}))

import Warehouse from './warehouse.model'
import {
  BranchWarehouseResolutionError,
  resolveWarehouseForBranch,
} from './branch-warehouse.resolution'

const branchId = 'b1111111-1111-4111-8111-111111111111'
const orgId = 'org-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveWarehouseForBranch', () => {
  it('requires a branch id', async () => {
    await expect(resolveWarehouseForBranch(null, orgId)).rejects.toMatchObject({
      code: 'BRANCH_ID_REQUIRED',
    })
  })

  it('fails when the branch has no assigned warehouse', async () => {
    ;(Warehouse.findAll as Mock).mockResolvedValue([])
    await expect(resolveWarehouseForBranch(branchId, orgId)).rejects.toMatchObject({
      code: 'BRANCH_WAREHOUSE_NOT_CONFIGURED',
    })
  })

  it('fails when multiple active warehouses are assigned', async () => {
    ;(Warehouse.findAll as Mock).mockResolvedValue([{ id: 'wh-1' }, { id: 'wh-2' }])
    await expect(resolveWarehouseForBranch(branchId, orgId)).rejects.toMatchObject({
      code: 'BRANCH_WAREHOUSE_AMBIGUOUS',
    })
  })

  it('returns the only active warehouse for the branch', async () => {
    ;(Warehouse.findAll as Mock).mockResolvedValue([{ id: 'wh-1' }])
    await expect(resolveWarehouseForBranch(branchId, orgId)).resolves.toBe('wh-1')
  })

  it('exposes BranchWarehouseResolutionError name', () => {
    const err = new BranchWarehouseResolutionError('BRANCH_ID_REQUIRED', 'test')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('BranchWarehouseResolutionError')
  })
})
