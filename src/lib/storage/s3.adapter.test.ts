import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send, S3Client, PutObjectCommand, lastPutObjectInput } = vi.hoisted(() => {
  const send = vi.fn()
  let lastPutObjectInput: unknown
  class S3Client {
    static lastConfig: unknown
    send = send
    constructor(config: unknown) {
      S3Client.lastConfig = config
    }
  }
  class PutObjectCommand {
    input: unknown
    constructor(input: unknown) {
      this.input = input
      lastPutObjectInput = input
    }
  }
  return { send, S3Client, PutObjectCommand, lastPutObjectInput: () => lastPutObjectInput }
})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client,
  PutObjectCommand,
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example/presigned'),
}))

import { S3StorageAdapter } from './s3.adapter'

const baseConfig = {
  bucket: 'test-bucket',
  region: 'sa-east-1',
  accessKeyId: 'AKIATEST',
  secretAccessKey: 'secret',
}

describe('S3StorageAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    send.mockResolvedValue({})
  })

  it('configures checksum calculation for presigned browser uploads', () => {
    new S3StorageAdapter(baseConfig)
    expect(S3Client.lastConfig).toEqual(
      expect.objectContaining({
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      }),
    )
  })

  it('putObject uploads bytes with PutObjectCommand', async () => {
    const adapter = new S3StorageAdapter(baseConfig)
    await adapter.putObject('_sys-admin/storage-test/file.txt', {
      contentType: 'text/plain',
      body: Buffer.from('hello'),
    })

    expect(lastPutObjectInput()).toEqual({
      Bucket: 'test-bucket',
      Key: '_sys-admin/storage-test/file.txt',
      ContentType: 'text/plain',
      Body: Buffer.from('hello'),
    })
    expect(send).toHaveBeenCalledOnce()
  })
})
