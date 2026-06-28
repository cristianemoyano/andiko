import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'
import type { FileActor } from './storage.authz'

// --- Mocks ---------------------------------------------------------------
vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn((cb: (t: unknown) => unknown) => cb({})) },
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/permissions', () => ({ can: vi.fn() }))

const { mockAdapter } = vi.hoisted(() => ({
  mockAdapter: {
    provider: 's3',
    bucket: 'test-bucket',
    getUploadUrl: vi.fn().mockResolvedValue({
      url: 'https://s3/put', method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, expiresInSeconds: 300,
    }),
    getDownloadUrl: vi.fn().mockResolvedValue({ url: 'https://s3/get', expiresInSeconds: 300 }),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  },
}))
vi.mock('@/lib/storage/adapter', () => ({ getStorageAdapter: () => mockAdapter }))

vi.mock('./file.model', () => ({
  default: { findOne: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn() },
  FILE_STATUSES: ['pending', 'available', 'failed'],
}))
vi.mock('./file-link.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  FILE_OWNER_TYPES: ['invoice', 'product', 'contact'],
}))
vi.mock('./file-share.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  SHARE_PRINCIPAL_TYPES: ['user', 'org_role', 'branch'],
  SHARE_PERMISSIONS: ['read', 'write'],
}))

const { ownerExists } = vi.hoisted(() => ({ ownerExists: vi.fn() }))
vi.mock('./owner-registry', () => ({
  OWNER_RESOLVERS: {
    invoice: { readPermission: 'sales:read', writePermission: 'sales:write', exists: ownerExists },
    product: { readPermission: 'products:read', writePermission: 'products:write', exists: ownerExists },
    contact: { readPermission: 'contacts:read', writePermission: 'contacts:write', exists: ownerExists },
  },
}))

import { can } from '@/lib/permissions'
import FileModel from './file.model'
import FileLink from './file-link.model'
import FileShare from './file-share.model'
import {
  initiateUpload,
  completeUpload,
  getDownloadUrl,
  STORAGE_ERRORS,
} from './storage.service'

// --- Fixtures ------------------------------------------------------------
const ctx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: 'branch-1',
  allowedBranchIds: ['branch-1'],
  salesScopeOwn: false,
}
const adminActor: FileActor = { ctx, role: 'admin', orgRoleId: null }
const opActor: FileActor = { ctx, role: 'operator', orgRoleId: null }

const mockFile = (overrides: Record<string, unknown> = {}) => {
  const file = {
    id: 'file-1',
    storage_provider: 's3',
    storage_key: 'org-1/file-1/doc.pdf',
    original_filename: 'doc.pdf',
    byte_size: '1024',
    status: 'available',
    created_by: 'user-1',
    update: vi.fn(async (patch: Record<string, unknown>) => Object.assign(file, patch)),
    toJSON: () => file,
    ...overrides,
  }
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(can as Mock).mockResolvedValue(true)
  ownerExists.mockResolvedValue(true)
  ;(FileLink.findAll as Mock).mockResolvedValue([])
  ;(FileShare.findAll as Mock).mockResolvedValue([])
})

describe('initiateUpload', () => {
  it('authorizes link, persists pending file + link, returns presigned PUT', async () => {
    // Echo the input so the generated id flows into the returned file + storage key.
    ;(FileModel.create as Mock).mockImplementation(async (attrs: { id: string }) => attrs)

    const res = await initiateUpload(
      { filename: 'doc.pdf', content_type: 'application/pdf', byte_size: 1024, links: [{ owner_type: 'invoice', owner_id: 'inv-1' }] },
      opActor,
    )

    expect(FileModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', org_id: 'org-1', byte_size: '1024' }),
      expect.anything(),
    )
    expect(FileLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ file_id: expect.any(String), owner_type: 'invoice', owner_id: 'inv-1' }),
      expect.anything(),
    )
    expect(res.upload_url).toBe('https://s3/put')
    // The link's file_id and the storage key are minted from the same generated id.
    expect(res.storage_key).toContain(res.file_id)
  })

  it('rejects when caller lacks write on the linked owner', async () => {
    ;(can as Mock).mockResolvedValue(false)
    await expect(
      initiateUpload(
        { filename: 'doc.pdf', content_type: 'application/pdf', byte_size: 1, links: [{ owner_type: 'invoice', owner_id: 'inv-1' }] },
        opActor,
      ),
    ).rejects.toThrow(STORAGE_ERRORS.OWNER_FORBIDDEN)
    expect(FileModel.create).not.toHaveBeenCalled()
  })

  it('rejects when the linked owner record is not visible', async () => {
    ownerExists.mockResolvedValue(false)
    await expect(
      initiateUpload(
        { filename: 'doc.pdf', content_type: 'application/pdf', byte_size: 1, links: [{ owner_type: 'invoice', owner_id: 'inv-x' }] },
        opActor,
      ),
    ).rejects.toThrow(STORAGE_ERRORS.OWNER_NOT_FOUND)
  })
})

describe('completeUpload', () => {
  it('flips pending → available when the object size matches', async () => {
    const file = mockFile({ status: 'pending' })
    ;(FileModel.findOne as Mock).mockResolvedValue(file)
    mockAdapter.headObject.mockResolvedValue({ byteSize: 1024, contentType: 'application/pdf' })

    await completeUpload('file-1', adminActor)

    expect(file.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'available', uploaded_at: expect.any(Date) }),
    )
  })

  it('marks failed and throws when the object is missing', async () => {
    const file = mockFile({ status: 'pending' })
    ;(FileModel.findOne as Mock).mockResolvedValue(file)
    mockAdapter.headObject.mockResolvedValue(null)

    await expect(completeUpload('file-1', adminActor)).rejects.toThrow(STORAGE_ERRORS.UPLOAD_NOT_FOUND)
    expect(file.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })

  it('marks failed and throws on size mismatch', async () => {
    const file = mockFile({ status: 'pending', byte_size: '1024' })
    ;(FileModel.findOne as Mock).mockResolvedValue(file)
    mockAdapter.headObject.mockResolvedValue({ byteSize: 9999, contentType: 'application/pdf' })

    await expect(completeUpload('file-1', adminActor)).rejects.toThrow(STORAGE_ERRORS.SIZE_MISMATCH)
    expect(file.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })

  it('is idempotent once available (no HEAD call)', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ status: 'available' }))
    await completeUpload('file-1', adminActor)
    expect(mockAdapter.headObject).not.toHaveBeenCalled()
  })
})

describe('getDownloadUrl (ReBAC read)', () => {
  it('refuses a file that is not yet available', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ status: 'pending' }))
    await expect(getDownloadUrl('file-1', opActor)).rejects.toThrow(STORAGE_ERRORS.FILE_NOT_READY)
  })

  it('allows read via inherited access from a linked record', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ created_by: 'someone-else' }))
    ;(FileLink.findAll as Mock).mockResolvedValue([{ owner_type: 'invoice', owner_id: 'inv-1' }])

    const res = await getDownloadUrl('file-1', opActor)
    expect(res.url).toBe('https://s3/get')
  })

  it('allows read via an explicit user share', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ created_by: 'someone-else' }))
    ;(FileShare.findAll as Mock).mockResolvedValue([
      { principal_type: 'user', principal_id: 'user-1', permission: 'read' },
    ])

    const res = await getDownloadUrl('file-1', opActor)
    expect(res.url).toBe('https://s3/get')
  })

  it('allows read via an org-role share', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ created_by: 'someone-else' }))
    ;(FileShare.findAll as Mock).mockResolvedValue([
      { principal_type: 'org_role', principal_id: 'role-9', permission: 'read' },
    ])

    const res = await getDownloadUrl('file-1', { ctx, role: 'operator', orgRoleId: 'role-9' })
    expect(res.url).toBe('https://s3/get')
  })

  it('denies a standalone file with no link, share, or ownership', async () => {
    ;(FileModel.findOne as Mock).mockResolvedValue(mockFile({ created_by: 'someone-else' }))
    await expect(getDownloadUrl('file-1', opActor)).rejects.toThrow(STORAGE_ERRORS.FILE_FORBIDDEN)
  })
})
