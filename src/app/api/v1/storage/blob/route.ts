import { NextRequest, NextResponse } from 'next/server'
import { getStorageAdapter } from '@/lib/storage/adapter'
import { verifyBlobToken } from '@/lib/storage/blob-token'

// The proxy streams bytes to/from the storage backend (Google Drive SDK needs Node, not Edge).
export const runtime = 'nodejs'

/**
 * Storage proxy for backends that can't issue presigned URLs (Google Drive in dev/staging).
 * The signed token IS the authorization — `storage.service` already ran the ReBAC check before
 * minting it, exactly like a presigned URL. No session/permission gate here on purpose.
 */

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const token = verifyBlobToken(req.nextUrl.searchParams.get('token') ?? '')
  if (!token || token.mode !== 'put') {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const adapter = getStorageAdapter()
  if (!adapter.putObject) {
    return NextResponse.json({ error: 'Proxy upload not supported', code: 'NOT_SUPPORTED' }, { status: 400 })
  }
  if (!req.body) {
    return NextResponse.json({ error: 'Empty body', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  await adapter.putObject(token.key, {
    contentType: token.contentType ?? 'application/octet-stream',
    body: req.body,
  })
  return new NextResponse(null, { status: 204 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = verifyBlobToken(req.nextUrl.searchParams.get('token') ?? '')
  if (!token || token.mode !== 'get') {
    return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 403 })
  }

  const adapter = getStorageAdapter()
  if (!adapter.getObjectStream) {
    return NextResponse.json({ error: 'Proxy download not supported', code: 'NOT_SUPPORTED' }, { status: 400 })
  }

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
}

/** RFC 5987 Content-Disposition so non-ASCII filenames download intact. */
function contentDisposition(filename?: string): string {
  if (!filename) return 'attachment'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
