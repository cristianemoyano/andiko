import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/env', () => ({
  env: { AUTH_SECRET: 'unit-test-secret-key-1234567890' },
}))

import { DropboxStorageAdapter, dropboxPath, mapDropboxError, sanitizeDropboxFilename } from './dropbox.adapter'
import { verifyBlobToken } from './blob-token'

const testConfig = {
  appKey: 'app-key',
  appSecret: 'app-secret',
  refreshToken: 'refresh-token',
  rootPath: '/andiko',
}

const accessTokenConfig = {
  appKey: 'app-key',
  accessToken: 'generated-access-token',
  rootPath: '/andiko',
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

function mockTokenRefresh() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
  })
}

describe('dropboxPath', () => {
  it('joins root path and storage key', () => {
    expect(dropboxPath('/andiko', 'org-1/file-1/doc.pdf')).toBe('/andiko/org-1/file-1/doc.pdf')
  })

  it('normalizes duplicate slashes', () => {
    expect(dropboxPath('/andiko/', 'org/file.pdf')).toBe('/andiko/org/file.pdf')
  })

  it('uses key-only path when root is / (App folder apps)', () => {
    expect(dropboxPath('/', 'org-1/file-1/doc.pdf')).toBe('/org-1/file-1/doc.pdf')
  })

  it('maps subfolder under app folder root', () => {
    expect(dropboxPath('/storage', 'org-1/file.pdf')).toBe('/storage/org-1/file.pdf')
  })

  it('replaces spaces in filenames for Dropbox-API-Arg safety', () => {
    expect(dropboxPath('/', 'org/file/Andiko POS.pdf')).toBe('/org/file/Andiko_POS.pdf')
  })
})

describe('sanitizeDropboxFilename', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeDropboxFilename('Andiko POS.pdf')).toBe('Andiko_POS.pdf')
  })
})

describe('DropboxStorageAdapter', () => {
  it('getUploadUrl returns a signed proxy URL with dropbox provider', async () => {
    const adapter = new DropboxStorageAdapter(testConfig)
    const res = await adapter.getUploadUrl({
      key: 'org-1/file-1/doc.pdf',
      contentType: 'application/pdf',
      byteSize: 10,
    })

    expect(res.method).toBe('PUT')
    expect(res.url.startsWith('/api/v1/storage/blob?token=')).toBe(true)
    const token = decodeURIComponent(res.url.split('token=')[1])
    expect(verifyBlobToken(token)).toMatchObject({
      provider: 'dropbox',
      key: 'org-1/file-1/doc.pdf',
      mode: 'put',
      byteSize: 10,
    })
  })

  it('putObject uploads to Dropbox with overwrite mode', async () => {
    mockTokenRefresh()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const adapter = new DropboxStorageAdapter(testConfig)
    await adapter.putObject('org-1/file-1/doc.pdf', {
      contentType: 'application/pdf',
      body: Buffer.from('hi'),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const uploadCall = fetchMock.mock.calls[1]
    expect(uploadCall[0]).toBe('https://content.dropboxapi.com/2/files/upload')
    expect(uploadCall[1]?.headers?.Authorization).toBe('Bearer access-token')
    expect(JSON.parse(uploadCall[1]?.headers?.['Dropbox-API-Arg'] as string)).toMatchObject({
      path: '/andiko/org-1/file-1/doc.pdf',
      mode: 'overwrite',
    })
  })

  it('putObject uses a generated access token without OAuth refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const adapter = new DropboxStorageAdapter(accessTokenConfig)
    await adapter.putObject('org-1/file-1/doc.pdf', {
      contentType: 'application/pdf',
      body: Buffer.from('hi'),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const uploadCall = fetchMock.mock.calls[0]
    expect(uploadCall[1]?.headers?.Authorization).toBe('Bearer generated-access-token')
  })

  it('headObject returns null when file is missing', async () => {
    mockTokenRefresh()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) })

    const adapter = new DropboxStorageAdapter(testConfig)
    expect(await adapter.headObject('missing')).toBeNull()
  })

  it('deleteObject ignores missing files', async () => {
    mockTokenRefresh()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) })

    const adapter = new DropboxStorageAdapter(testConfig)
    await expect(adapter.deleteObject('missing')).resolves.toBeUndefined()
  })
})

describe('mapDropboxError', () => {
  it('maps invalid_grant to a refresh-token hint', () => {
    const msg = mapDropboxError(new Error('invalid_grant'))
    expect(msg).toContain('refresh token')
  })

  it('maps missing_scope to a regenerate-token hint', () => {
    const msg = mapDropboxError(new Error('missing_scope/'))
    expect(msg).toContain('token nuevo')
  })
})
