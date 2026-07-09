import 'server-only'
import logger from '@/lib/logger'
import type { StorageAdapter } from '@/lib/storage/adapter'
import { getStorageAdapter } from '@/lib/storage/adapter'
import { getActiveStorageProvider, isStorageProviderReady } from './storage-settings.service'
import { STORAGE_ERRORS } from './storage.service'

export const STORAGE_TEST_FAILED = 'STORAGE_TEST_FAILED'
export const STORAGE_TEST_INVALID_KEY = 'STORAGE_TEST_INVALID_KEY'

const TEST_CONTENT_TYPE = 'text/plain'
export const STORAGE_TEST_KEY_PREFIX = '_sys-admin/storage-test'
const TEST_BODY = Buffer.from('Andiko storage connectivity test\n', 'utf8')

export interface RunStorageTestResult {
  provider: string
  bucket: string
  storage_key: string
  byte_size: number
  checks: {
    upload: true
    download: true
    preview: true
  }
}

export function isStorageTestKey(storageKey: string): boolean {
  return storageKey.startsWith(`${STORAGE_TEST_KEY_PREFIX}/`)
}

/**
 * Uploads a tiny test object with the saved platform storage settings, verifies it via
 * HeadObject, then exercises presigned download and stream read (preview path). The object
 * stays in the backend until sys-admin deletes it explicitly.
 */
export async function runStorageConnectivityTest(): Promise<RunStorageTestResult> {
  const adapter = await resolveStorageAdapter()
  const storageKey = `${STORAGE_TEST_KEY_PREFIX}/${Date.now()}-andiko-test.txt`

  try {
    await writeTestObject(adapter, storageKey, TEST_BODY)

    const head = await adapter.headObject(storageKey)
    if (!head) {
      throw testError('El objeto de prueba no apareció en el backend después de subirlo.')
    }
    if (head.byteSize !== TEST_BODY.length) {
      throw testError(
        `Tamaño incorrecto: esperado ${TEST_BODY.length}, obtenido ${head.byteSize}.`,
      )
    }

    await verifyDownload(adapter, storageKey, TEST_BODY)
    await verifyPreview(adapter, storageKey, TEST_BODY)

    logger.info(
      { provider: adapter.provider, storageKey, bucket: adapter.bucket },
      'storage connectivity test ok',
    )

    return {
      provider: adapter.provider,
      bucket: adapter.bucket,
      storage_key: storageKey,
      byte_size: head.byteSize,
      checks: { upload: true, download: true, preview: true },
    }
  } catch (err: unknown) {
    try {
      await adapter.deleteObject(storageKey)
    } catch (cleanupErr: unknown) {
      logger.warn(
        { storageKey, err: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr },
        'storage test failed-upload cleanup',
      )
    }

    if (err instanceof Error && err.message === STORAGE_ERRORS.STORAGE_NOT_CONFIGURED) {
      throw err
    }
    if (err instanceof Error && err.message === STORAGE_TEST_FAILED) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Error desconocido'
    logger.error({ storageKey, err: message }, 'storage connectivity test failed')
    throw testError(formatStorageTestError(err))
  }
}

function formatStorageTestError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Error desconocido'
  const e = err as { name?: string; message?: string }
  const msg = e.message ?? ''

  if (e.name === 'SignatureDoesNotMatch' || msg.includes('signature we calculated does not match')) {
    return 'Las credenciales AWS no coinciden (access key, secret key o región). Revisá la configuración y guardá de nuevo.'
  }
  if (e.name === 'InvalidAccessKeyId' || msg.includes('The AWS Access Key Id you provided does not exist')) {
    return 'El access key ID no existe en AWS.'
  }
  if (e.name === 'NoSuchBucket' || msg.includes('The specified bucket does not exist')) {
    return 'El bucket no existe en esa región.'
  }
  if (e.name === 'AccessDenied' || msg.includes('Access Denied')) {
    return 'Acceso denegado al bucket. Confirmá permisos de lectura y eliminación sobre los objetos.'
  }

  return msg || 'Error desconocido'
}

/** Deletes a previously uploaded sys-admin test object from the active backend. */
export async function deleteStorageTestObject(storageKey: string): Promise<void> {
  if (!isStorageTestKey(storageKey)) {
    throw new Error(STORAGE_TEST_INVALID_KEY)
  }

  const adapter = await resolveStorageAdapter()

  try {
    const head = await adapter.headObject(storageKey)
    if (!head) {
      logger.info({ storageKey }, 'storage test object already absent')
      return
    }

    await adapter.deleteObject(storageKey)

    const stillThere = await adapter.headObject(storageKey)
    if (stillThere) {
      throw testError('El backend no confirmó la eliminación del archivo de prueba.')
    }

    logger.info({ storageKey, provider: adapter.provider }, 'storage test object deleted')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === STORAGE_TEST_INVALID_KEY) throw err
    if (err instanceof Error && err.message === STORAGE_TEST_FAILED) throw err
    if (err instanceof Error && err.message === STORAGE_ERRORS.STORAGE_NOT_CONFIGURED) throw err
    logger.error(
      { storageKey, err: err instanceof Error ? err.message : err },
      'storage test object delete failed',
    )
    throw testError(formatStorageTestError(err))
  }
}

async function resolveStorageAdapter(): Promise<StorageAdapter> {
  const provider = await getActiveStorageProvider()
  if (!provider || !(await isStorageProviderReady(provider))) {
    throw new Error(STORAGE_ERRORS.STORAGE_NOT_CONFIGURED)
  }

  const adapter = await getStorageAdapter(provider)
  if (!adapter) throw new Error(STORAGE_ERRORS.STORAGE_NOT_CONFIGURED)
  return adapter
}

function testError(detail: string): Error & { detail: string } {
  const wrapped = new Error(STORAGE_TEST_FAILED) as Error & { detail: string }
  wrapped.detail = detail
  return wrapped
}

async function writeTestObject(adapter: StorageAdapter, key: string, body: Buffer): Promise<void> {
  if (adapter.provider === 's3') {
    await uploadViaPresignedUrl(adapter, key, body)
    return
  }

  if (adapter.putObject) {
    await adapter.putObject(key, { contentType: TEST_CONTENT_TYPE, body })
    return
  }

  await uploadViaPresignedUrl(adapter, key, body)
}

async function uploadViaPresignedUrl(
  adapter: StorageAdapter,
  key: string,
  body: Buffer,
): Promise<void> {
  const upload = await adapter.getUploadUrl({
    key,
    contentType: TEST_CONTENT_TYPE,
    byteSize: body.length,
  })
  const res = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al subir el archivo de prueba`)
  }
}

async function verifyDownload(
  adapter: StorageAdapter,
  key: string,
  expected: Buffer,
): Promise<void> {
  const download = await adapter.getDownloadUrl({ key })
  const res = await fetch(download.url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar el archivo de prueba`)
  }
  const body = Buffer.from(await res.arrayBuffer())
  if (!body.equals(expected)) {
    throw new Error('El contenido descargado no coincide con el archivo de prueba.')
  }
}

async function verifyPreview(
  adapter: StorageAdapter,
  key: string,
  expected: Buffer,
): Promise<void> {
  if (!adapter.getObjectStream) {
    throw new Error('El backend no soporta lectura por stream (vista previa).')
  }
  const object = await adapter.getObjectStream(key)
  if (!object) {
    throw new Error('No se pudo leer el archivo de prueba para vista previa.')
  }
  const body = await readStreamToBuffer(object.stream)
  if (!body.equals(expected)) {
    throw new Error('El contenido de vista previa no coincide con el archivo de prueba.')
  }
}

async function readStreamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}
