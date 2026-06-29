import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'
import logger from '@/lib/logger'
import { getStorageAdapter } from '@/lib/storage/adapter'
import { mapGDriveError } from '@/lib/storage/gdrive.adapter'
import { mapDropboxError } from '@/lib/storage/dropbox.adapter'
import { verifyBlobToken } from '@/lib/storage/blob-token'
import type { ProxyStorageProvider } from '@/modules/storage/storage-settings.schema'

export const runtime = 'nodejs'

/** Reads a request body stream, rejecting when total bytes exceed `maxBytes`. */
async function readBodyWithLimit(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      throw new Error('PAYLOAD_TOO_LARGE')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

function resolveProxyProvider(tokenProvider: string | undefined): ProxyStorageProvider | null {
  if (tokenProvider === 'dropbox') return 'dropbox'
  if (tokenProvider === 'gdrive' || tokenProvider == null) return 'gdrive'
  return null
}

function mapStorageBackendError(err: unknown, provider: ProxyStorageProvider): string | null {
  if (provider === 'dropbox') return mapDropboxError(err)
  return mapGDriveError(err)
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const token = verifyBlobToken(req.nextUrl.searchParams.get('token') ?? '')
  if (!token || token.mode !== 'put') {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const provider = resolveProxyProvider(token.provider)
  if (!provider) {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const maxBytes = token.byteSize ?? env.FILE_MAX_BYTES
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    return NextResponse.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }

  const adapter = await getStorageAdapter(provider)
  if (!adapter?.putObject) {
    return NextResponse.json({ error: 'Proxy upload not supported', code: 'NOT_SUPPORTED' }, { status: 400 })
  }
  if (!req.body) {
    return NextResponse.json({ error: 'Empty body', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const body = await readBodyWithLimit(req.body, maxBytes)
    await adapter.putObject(token.key, {
      contentType: token.contentType ?? 'application/octet-stream',
      body,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      return NextResponse.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    const backendMsg = mapStorageBackendError(err, provider)
    if (backendMsg) {
      logger.warn({ err, provider, key: token.key }, 'storage blob upload failed')
      return NextResponse.json({ error: backendMsg, code: 'STORAGE_BACKEND_ERROR' }, { status: 502 })
    }
    throw err
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = verifyBlobToken(req.nextUrl.searchParams.get('token') ?? '')
  if (!token || token.mode !== 'get') {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const provider = resolveProxyProvider(token.provider)
  if (!provider) {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const adapter = await getStorageAdapter(provider)
  if (!adapter?.getObjectStream) {
    return NextResponse.json({ error: 'Proxy download not supported', code: 'NOT_SUPPORTED' }, { status: 400 })
  }

  try {
    const object = await adapter.getObjectStream(token.key)
    if (!object) {
      return NextResponse.json({ error: 'Not found', code: 'FILE_NOT_FOUND' }, { status: 404 })
    }

    const headers = new Headers({
      'Content-Type': object.contentType ?? 'application/octet-stream',
      'Content-Disposition': contentDisposition(token.filename),
    })
    if (object.byteSize != null) headers.set('Content-Length', String(object.byteSize))
    return new NextResponse(object.stream, { status: 200, headers })
  } catch (err) {
    const backendMsg = mapStorageBackendError(err, provider)
    if (backendMsg) {
      return NextResponse.json({ error: backendMsg, code: 'STORAGE_BACKEND_ERROR' }, { status: 502 })
    }
    throw err
  }
}

function contentDisposition(filename?: string): string {
  if (!filename) return 'attachment'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
