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
  })

  it('throws when storage is not configured', async () => {
    getActiveStorageProvider.mockResolvedValue(null)
    await expect(runStorageConnectivityTest()).rejects.toThrow('STORAGE_NOT_CONFIGURED')
  })

  it('uploads and verifies without deleting on success', async () => {
    const putObject = vi.fn().mockResolvedValue(undefined)
    const headObject = vi.fn().mockResolvedValue({ byteSize: 33, contentType: 'text/plain' })
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    getStorageAdapter.mockResolvedValue({
      provider: 's3',
      bucket: 'test-bucket',
      putObject,
      headObject,
      deleteObject,
    })

    const result = await runStorageConnectivityTest()

    expect(result.provider).toBe('s3')
    expect(result.bucket).toBe('test-bucket')
    expect(result.byte_size).toBe(33)
    expect(result.storage_key).toMatch(/^_sys-admin\/storage-test\//)
    expect(putObject).toHaveBeenCalledOnce()
    expect(headObject).toHaveBeenCalledOnce()
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('cleans up on failure', async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    getStorageAdapter.mockResolvedValue({
      provider: 's3',
      bucket: 'test-bucket',
      putObject: vi.fn().mockResolvedValue(undefined),
      headObject: vi.fn().mockResolvedValue(null),
      deleteObject,
    })

    await expect(runStorageConnectivityTest()).rejects.toThrow(STORAGE_TEST_FAILED)
    expect(deleteObject).toHaveBeenCalledOnce()
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
    ).rejects.toThrow(STORAGE_TEST_FAILED)
  })
})
