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
vi.mock('@/lib/storage/adapter', () => ({ getStorageAdapter: vi.fn().mockResolvedValue(mockAdapter) }))
vi.mock('./storage-settings.service', () => ({
  getActiveStorageProvider: vi.fn().mockResolvedValue('s3'),
  isStorageProviderReady: vi.fn().mockResolvedValue(true),
}))

vi.mock('./file.model', () => ({
  default: { findOne: vi.fn(), findAll: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn() },
  FILE_STATUSES: ['pending', 'available', 'failed'],
}))
vi.mock('./file-link.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  FILE_OWNER_TYPES: ['invoice', 'product', 'contact', 'supplier_invoice', 'purchase_receipt'],
}))
vi.mock('./file-share.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  SHARE_PRINCIPAL_TYPES: ['user', 'org_role', 'branch'],
  SHARE_PERMISSIONS: ['read', 'write'],
}))

const { ownerExists, pathContextMock } = vi.hoisted(() => ({
  ownerExists: vi.fn(),
  pathContextMock: vi.fn(),
}))
vi.mock('./owner-registry', () => ({
  OWNER_RESOLVERS: {
    invoice: { readPermission: 'sales:read', writePermission: 'sales:write', exists: ownerExists, pathContext: pathContextMock },
    product: { readPermission: 'products:read', writePermission: 'products:write', exists: ownerExists, pathContext: pathContextMock },
    contact: { readPermission: 'contacts:read', writePermission: 'contacts:write', exists: ownerExists, pathContext: pathContextMock },
    supplier_invoice: { readPermission: 'purchases:read', writePermission: 'purchases:write', exists: ownerExists, pathContext: pathContextMock },
    purchase_receipt: { readPermission: 'purchases:read', writePermission: 'purchases:write', exists: ownerExists, pathContext: pathContextMock },
  },
}))

const { buildStorageKeyMock } = vi.hoisted(() => ({ buildStorageKeyMock: vi.fn() }))
vi.mock('./storage-path.service', () => ({ buildStorageKey: buildStorageKeyMock }))

import { can } from '@/lib/permissions'
import FileModel from './file.model'
import FileLink from './file-link.model'
import FileShare from './file-share.model'
import {
  initiateUpload,
  completeUpload,
  getDownloadUrl,
  listSharedWithMeFiles,
  resolvePreviewContentType,
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
  buildStorageKeyMock.mockImplementation(async ({ fileId, filename }: { fileId: string; filename: string }) =>
    `acme/suc-001/ventas/facturas/2026/06/28/fc-1__${fileId.split('-')[0]}__${filename.replace(/\s/g, '_')}`,
  )
  ;(FileLink.findAll as Mock).mockResolvedValue([])
  ;(FileShare.findAll as Mock).mockResolvedValue([])
})

describe('resolvePreviewContentType', () => {
  it('uses stored file type when Dropbox returns octet-stream', () => {
    expect(resolvePreviewContentType('application/octet-stream', 'application/pdf')).toBe('application/pdf')
  })

  it('keeps a specific backend type when present', () => {
    expect(resolvePreviewContentType('image/png', 'application/pdf')).toBe('image/png')
  })
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
    expect(buildStorageKeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        filename: 'doc.pdf',
        primaryLink: { owner_type: 'invoice', owner_id: 'inv-1' },
      }),
    )
    expect(res.storage_key).toContain('acme/suc-001/ventas/facturas')
    expect(res.storage_key).not.toContain('org-1')
    expect(res.storage_key).toContain(res.file_id.split('-')[0])
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

describe('listSharedWithMeFiles', () => {
  it('returns files shared directly with the user', async () => {
    const sharedAt = new Date('2026-06-20T10:00:00Z')
    ;(FileShare.findAll as Mock).mockResolvedValue([
      { file_id: 'file-shared', permission: 'read', created_at: sharedAt },
    ])
    ;(FileModel.findAll as Mock).mockResolvedValue([
      mockFile({
        id: 'file-shared',
        original_filename: 'contrato.pdf',
        content_type: 'application/pdf',
        status: 'available',
        created_at: sharedAt,
        uploaded_at: sharedAt,
      }),
    ])
    ;(FileLink.findAll as Mock).mockResolvedValue([
      { file_id: 'file-shared', owner_type: 'supplier_invoice', owner_id: 'inv-1' },
    ])

    const res = await listSharedWithMeFiles({ page: 1, limit: 20 }, opActor)
    expect(res.total).toBe(1)
    expect(res.data[0]?.original_filename).toBe('contrato.pdf')
    expect(res.data[0]?.share_permission).toBe('read')
    expect(res.data[0]?.owner_links[0]?.owner_type).toBe('supplier_invoice')
  })

  it('returns empty when there are no shares', async () => {
    ;(FileShare.findAll as Mock).mockResolvedValue([])
    const res = await listSharedWithMeFiles({ page: 1, limit: 20 }, opActor)
    expect(res.total).toBe(0)
    expect(res.data).toEqual([])
  })
})
