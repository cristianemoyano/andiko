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
  env: {
    AUTH_SECRET: 'unit-test-secret-key-1234567890',
    // base64 of "{}" — credentials are not validated by the mocked client.
    GDRIVE_SERVICE_ACCOUNT_JSON: Buffer.from('{}').toString('base64'),
    GDRIVE_FOLDER_ID: 'folder-1',
  },
}))

vi.mock('@googleapis/drive', () => ({
  drive: () => driveClient,
  auth: { GoogleAuth: class { } },
}))

import { GoogleDriveStorageAdapter } from './gdrive.adapter'
import { verifyBlobToken } from './blob-token'

beforeEach(() => vi.clearAllMocks())

describe('GoogleDriveStorageAdapter', () => {
  it('getUploadUrl returns a signed proxy URL with a put token', async () => {
    const adapter = new GoogleDriveStorageAdapter()
    const res = await adapter.getUploadUrl({ key: 'org-1/file-1/doc.pdf', contentType: 'application/pdf', byteSize: 10 })

    expect(res.method).toBe('PUT')
    expect(res.url.startsWith('/api/v1/storage/blob?token=')).toBe(true)
    const token = decodeURIComponent(res.url.split('token=')[1])
    expect(verifyBlobToken(token)).toMatchObject({ key: 'org-1/file-1/doc.pdf', mode: 'put' })
  })

  it('putObject tags the Drive file with our key in appProperties', async () => {
    const adapter = new GoogleDriveStorageAdapter()
    await adapter.putObject('org-1/file-1/doc.pdf', { contentType: 'application/pdf', body: Buffer.from('hi') })

    expect(driveClient.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'doc.pdf',
          parents: ['folder-1'],
          appProperties: { key: 'org-1/file-1/doc.pdf' },
        }),
        media: expect.objectContaining({ mimeType: 'application/pdf' }),
      }),
    )
  })

  it('headObject resolves key → Drive metadata', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({
      data: { files: [{ id: 'g1', size: '1024', mimeType: 'application/pdf' }] },
    })
    const adapter = new GoogleDriveStorageAdapter()
    const head = await adapter.headObject('org-1/file-1/doc.pdf')

    expect(driveClient.files.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: expect.stringContaining("appProperties has { key='org-1/file-1/doc.pdf' }") }),
    )
    expect(head).toEqual({ byteSize: 1024, contentType: 'application/pdf' })
  })

  it('headObject returns null when the object is absent', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [] } })
    const adapter = new GoogleDriveStorageAdapter()
    expect(await adapter.headObject('missing')).toBeNull()
  })

  it('deleteObject resolves the id then deletes', async () => {
    ;(driveClient.files.list as Mock).mockResolvedValue({ data: { files: [{ id: 'g1' }] } })
    const adapter = new GoogleDriveStorageAdapter()
    await adapter.deleteObject('org-1/file-1/doc.pdf')
    expect(driveClient.files.delete).toHaveBeenCalledWith({ fileId: 'g1' })
  })
})
