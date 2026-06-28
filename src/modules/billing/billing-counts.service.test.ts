import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/auth/user.model', () => ({ default: { count: vi.fn() } }))
vi.mock('@/modules/auth/branch.model', () => ({ default: { count: vi.fn() } }))
vi.mock('@/modules/storage/file.model', () => ({ default: { findOne: vi.fn() } }))

import FileModel from '@/modules/storage/file.model'
import { countStorageUsage } from './billing-counts.service'

beforeEach(() => vi.clearAllMocks())

describe('countStorageUsage', () => {
  it('returns summed bytes and file count for available files', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue({ bytes: '1048576', files: 4 })

    const result = await countStorageUsage('org-1')

    expect(result).toEqual({ bytes: '1048576', files: 4 })
    expect(FileModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { org_id: 'org-1', status: 'available' },
        paranoid: true,
        raw: true,
      }),
    )
  })

  it('coerces null aggregates to zero (no files yet)', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue({ bytes: null, files: 0 })
    expect(await countStorageUsage('org-1')).toEqual({ bytes: '0', files: 0 })
  })
})
