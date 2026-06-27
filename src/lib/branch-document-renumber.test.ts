import { describe, expect, it, vi } from 'vitest'
import {
  assertDraftBranchChange,
  buildBranchRenumberPatch,
  DOCUMENT_BRANCH_NOT_CHANGEABLE,
} from './branch-document-renumber'

describe('assertDraftBranchChange', () => {
  it('allows draft', () => {
    expect(() => assertDraftBranchChange('draft')).not.toThrow()
  })

  it('rejects non-draft', () => {
    expect(() => assertDraftBranchChange('issued')).toThrow(DOCUMENT_BRANCH_NOT_CHANGEABLE)
  })
})

describe('buildBranchRenumberPatch', () => {
  const t = {} as import('sequelize').Transaction

  it('returns empty patch when branch unchanged', async () => {
    await expect(buildBranchRenumberPatch({
      orgId: 'org-1',
      currentBranchId: 'branch-a',
      nextBranchId: 'branch-a',
      numberField: 'order_number',
      resolveNextNumber: vi.fn(),
      t,
    })).resolves.toEqual({})
  })

  it('returns branch and renumbered field when branch changes', async () => {
    const resolveNextNumber = vi.fn().mockResolvedValue('PED-02-0015')
    await expect(buildBranchRenumberPatch({
      orgId: 'org-1',
      currentBranchId: 'branch-a',
      nextBranchId: 'branch-b',
      numberField: 'order_number',
      resolveNextNumber,
      t,
    })).resolves.toEqual({
      branch_id: 'branch-b',
      order_number: 'PED-02-0015',
    })
    expect(resolveNextNumber).toHaveBeenCalledWith('org-1', 'branch-b', t)
  })
})
