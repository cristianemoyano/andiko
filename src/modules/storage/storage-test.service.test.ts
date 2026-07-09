import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteStorageTestObject,
  isStorageTestKey,
  runStorageConnectivityTest,
  STORAGE_TEST_FAILED,
  STORAGE_TEST_INVALID_KEY,
} from './storage-test.service'

const getActiveStorageProvider = vi.fn()
const isStorageProviderReady = vi.fn()
const getStorageAdapter = vi.fn()

const TEST_BODY = Buffer.from('Andiko storage connectivity test\n', 'utf8')

function makeS3Adapter(overrides: Record<string, unknown> = {}) {
  return {
    provider: 's3',
    bucket: 'test-bucket',
    getUploadUrl: vi.fn().mockResolvedValue({
      url: 'https://s3.example/upload',
      method: 'PUT' as const,
      headers: { 'Content-Type': 'text/plain' },
      expiresInSeconds: 900,
    }),
    getDownloadUrl: vi.fn().mockResolvedValue({
      url: 'https://s3.example/download',
      expiresInSeconds: 900,
    }),
    getObjectStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(TEST_BODY))
          controller.close()
        },
      }),
      contentType: 'text/plain',
      byteSize: TEST_BODY.length,
    }),
    headObject: vi.fn().mockResolvedValue({ byteSize: TEST_BODY.length, contentType: 'text/plain' }),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./storage.service', () => ({
  STORAGE_ERRORS: { STORAGE_NOT_CONFIGURED: 'STORAGE_NOT_CONFIGURED' },
}))

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: (...args: unknown[]) => getStorageAdapter(...args),
}))

vi.mock('./storage-settings.service', () => ({
  getActiveStorageProvider: (...args: unknown[]) => getActiveStorageProvider(...args),
  isStorageProviderReady: (...args: unknown[]) => isStorageProviderReady(...args),
}))

describe('isStorageTestKey', () => {
  it('accepts keys under the sys-admin test prefix', () => {
    expect(isStorageTestKey('_sys-admin/storage-test/123-andiko-test.txt')).toBe(true)
  })

  it('rejects other keys', () => {
    expect(isStorageTestKey('attachments/foo.pdf')).toBe(false)
    expect(isStorageTestKey('_sys-admin/storage-test')).toBe(false)
  })
})

describe('runStorageConnectivityTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActiveStorageProvider.mockResolvedValue('s3')
    isStorageProviderReady.mockResolvedValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === 'https://s3.example/upload') {
          return Promise.resolve(new Response(null, { status: 200 }))
        }
        if (url === 'https://s3.example/download') {
          return Promise.resolve(new Response(TEST_BODY, { status: 200 }))
        }
        return Promise.resolve(new Response(null, { status: 404 }))
      }),
    )
  })

  it('throws when storage is not configured', async () => {
    getActiveStorageProvider.mockResolvedValue(null)
    await expect(runStorageConnectivityTest()).rejects.toThrow('STORAGE_NOT_CONFIGURED')
  })

  it('uploads via presigned PUT, verifies download and preview without deleting on success', async () => {
    const adapter = makeS3Adapter()
    getStorageAdapter.mockResolvedValue(adapter)

    const result = await runStorageConnectivityTest()

    expect(result.provider).toBe('s3')
    expect(result.bucket).toBe('test-bucket')
    expect(result.byte_size).toBe(TEST_BODY.length)
    expect(result.storage_key).toMatch(/^_sys-admin\/storage-test\//)
    expect(result.checks).toEqual({ upload: true, download: true, preview: true })
    expect(adapter.getUploadUrl).toHaveBeenCalledOnce()
    expect(adapter.headObject).toHaveBeenCalledOnce()
    expect(adapter.getDownloadUrl).toHaveBeenCalledOnce()
    expect(adapter.getObjectStream).toHaveBeenCalledOnce()
    expect(adapter.deleteObject).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      'https://s3.example/upload',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(fetch).toHaveBeenCalledWith('https://s3.example/download')
  })

  it('uses putObject for non-s3 providers', async () => {
    const putObject = vi.fn().mockResolvedValue(undefined)
    getStorageAdapter.mockResolvedValue(
      makeS3Adapter({
        provider: 'gdrive',
        putObject,
      }),
    )

    const result = await runStorageConnectivityTest()

    expect(result.checks).toEqual({ upload: true, download: true, preview: true })
    expect(putObject).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalledWith(
      'https://s3.example/upload',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('cleans up on failure', async () => {
    const adapter = makeS3Adapter({
      headObject: vi.fn().mockResolvedValue(null),
    })
    getStorageAdapter.mockResolvedValue(adapter)

    await expect(runStorageConnectivityTest()).rejects.toThrow(STORAGE_TEST_FAILED)
    expect(adapter.deleteObject).toHaveBeenCalledOnce()
  })

  it('fails when download content does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === 'https://s3.example/upload') {
          return Promise.resolve(new Response(null, { status: 200 }))
        }
        if (url === 'https://s3.example/download') {
          return Promise.resolve(new Response(Buffer.from('wrong'), { status: 200 }))
        }
        return Promise.resolve(new Response(null, { status: 404 }))
      }),
    )
    getStorageAdapter.mockResolvedValue(makeS3Adapter())

    await expect(runStorageConnectivityTest()).rejects.toMatchObject({
      message: STORAGE_TEST_FAILED,
      detail: expect.stringContaining('contenido descargado no coincide'),
    })
  })

  it('fails when preview stream is missing', async () => {
    getStorageAdapter.mockResolvedValue(
      makeS3Adapter({
        getObjectStream: vi.fn().mockResolvedValue(null),
      }),
    )

    await expect(runStorageConnectivityTest()).rejects.toMatchObject({
      message: STORAGE_TEST_FAILED,
      detail: expect.stringContaining('vista previa'),
    })
  })

  it('maps AWS signature errors to a credential hint', async () => {
    const signatureErr = Object.assign(new Error('The request signature we calculated does not match'), {
      name: 'SignatureDoesNotMatch',
    })
    getStorageAdapter.mockResolvedValue(
      makeS3Adapter({
        getUploadUrl: vi.fn().mockRejectedValue(signatureErr),
      }),
    )

    await expect(runStorageConnectivityTest()).rejects.toMatchObject({
      message: STORAGE_TEST_FAILED,
      detail: expect.stringContaining('credenciales AWS no coinciden'),
    })
  })
})

describe('deleteStorageTestObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActiveStorageProvider.mockResolvedValue('s3')
    isStorageProviderReady.mockResolvedValue(true)
  })

  it('rejects keys outside the test prefix', async () => {
    await expect(deleteStorageTestObject('attachments/foo.pdf')).rejects.toThrow(STORAGE_TEST_INVALID_KEY)
  })

  it('deletes an existing test object and verifies removal', async () => {
    const storageKey = '_sys-admin/storage-test/123-andiko-test.txt'
    const headObject = vi
      .fn()
      .mockResolvedValueOnce({ byteSize: 32, contentType: 'text/plain' })
      .mockResolvedValueOnce(null)
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    getStorageAdapter.mockResolvedValue({
      provider: 's3',
      bucket: 'test-bucket',
      headObject,
      deleteObject,
    })

    await deleteStorageTestObject(storageKey)

    expect(headObject).toHaveBeenCalledTimes(2)
    expect(deleteObject).toHaveBeenCalledWith(storageKey)
  })

  it('fails when the object is missing', async () => {
    getStorageAdapter.mockResolvedValue({
      provider: 's3',
      bucket: 'test-bucket',
      headObject: vi.fn().mockResolvedValue(null),
      deleteObject: vi.fn(),
    })

    await expect(
      deleteStorageTestObject('_sys-admin/storage-test/123-andiko-test.txt'),
    ).resolves.toBeUndefined()
  })

  it('maps delete AWS errors to STORAGE_TEST_FAILED', async () => {
    getStorageAdapter.mockResolvedValue({
      provider: 's3',
      bucket: 'test-bucket',
      headObject: vi.fn().mockResolvedValue({ byteSize: 33, contentType: 'text/plain' }),
      deleteObject: vi.fn().mockRejectedValue(
        Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }),
      ),
    })

    await expect(
      deleteStorageTestObject('_sys-admin/storage-test/123-andiko-test.txt'),
    ).rejects.toMatchObject({
      message: STORAGE_TEST_FAILED,
      detail: expect.stringContaining('Acceso denegado'),
    })
  })
})
