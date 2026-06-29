import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

const driveClient = vi.hoisted(() => ({
  files: {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/config/env', () => ({
  env: { AUTH_SECRET: 'unit-test-secret-key-1234567890' },
}))

vi.mock('@googleapis/drive', () => ({
  drive: () => driveClient,
  auth: { GoogleAuth: class { } },
}))

import { GoogleDriveStorageAdapter, mapGDriveError } from './gdrive.adapter'
import { verifyBlobToken } from './blob-token'

const testConfig = { folderId: 'folder-1', serviceAccountJson: '{}' }

beforeEach(() => vi.clearAllMocks())

describe('GoogleDriveStorageAdapter', () => {
  it('getUploadUrl returns a signed proxy URL with a put token', async () => {
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    const res = await adapter.getUploadUrl({ key: 'org-1/file-1/doc.pdf', contentType: 'application/pdf', byteSize: 10 })

    expect(res.method).toBe('PUT')
    expect(res.url.startsWith('/api/v1/storage/blob?token=')).toBe(true)
    const token = decodeURIComponent(res.url.split('token=')[1])
    expect(verifyBlobToken(token)).toMatchObject({
      provider: 'gdrive',
      key: 'org-1/file-1/doc.pdf',
      mode: 'put',
      byteSize: 10,
    })
  })

  it('putObject tags the Drive file with our key in appProperties', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [] } })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    await adapter.putObject('org-1/file-1/doc.pdf', { contentType: 'application/pdf', body: Buffer.from('hi') })

    expect(driveClient.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'doc.pdf',
          parents: ['folder-1'],
          appProperties: { key: 'org-1/file-1/doc.pdf' },
        }),
        media: expect.objectContaining({ mimeType: 'application/pdf' }),
        supportsAllDrives: true,
      }),
    )
  })

  it('putObject replaces an existing object for the same key', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [{ id: 'g-old' }] } })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    await adapter.putObject('org-1/file-1/doc.pdf', { contentType: 'application/pdf', body: Buffer.from('hi') })

    expect(driveClient.files.delete).toHaveBeenCalledWith({ fileId: 'g-old', supportsAllDrives: true })
    expect(driveClient.files.create).toHaveBeenCalled()
  })

  it('headObject resolves key → Drive metadata', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({
      data: { files: [{ id: 'g1', size: '1024', mimeType: 'application/pdf' }] },
    })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    const head = await adapter.headObject('org-1/file-1/doc.pdf')

    expect(driveClient.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "appProperties has { key='key' and value='org-1/file-1/doc.pdf' } and trashed = false",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
      }),
    )
    expect(head).toEqual({ byteSize: 1024, contentType: 'application/pdf' })
  })

  it('headObject returns null when the object is absent', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [] } })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    expect(await adapter.headObject('missing')).toBeNull()
  })

  it('escapes quotes in storage keys for Drive search', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [] } })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    await adapter.headObject("org/file/o'reilly.pdf")

    expect(driveClient.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "appProperties has { key='key' and value='org/file/o\\'reilly.pdf' } and trashed = false",
      }),
    )
  })

  it('deleteObject resolves the id then deletes', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [{ id: 'g1' }] } })
    const adapter = new GoogleDriveStorageAdapter(testConfig)
    await adapter.deleteObject('org-1/file-1/doc.pdf')
    expect(driveClient.files.delete).toHaveBeenCalledWith({ fileId: 'g1', supportsAllDrives: true })
  })
})

describe('mapGDriveError', () => {
  it('maps service account quota errors to a Shared Drive hint', () => {
    const msg = mapGDriveError({
      cause: { message: 'Service Accounts do not have storage quota.' },
    })
    expect(msg).toContain('Unidad compartida')
  })
})
