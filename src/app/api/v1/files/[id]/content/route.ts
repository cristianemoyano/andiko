import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { getFileContentStream } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string }

/** Streams a file inline for in-app preview (PDF/image). No Content-Disposition — type drives rendering. */
export const GET = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    const content = await getFileContentStream(id, buildFileActor(session, tenant))
    const headers = new Headers({
      'Content-Type': content.contentType,
      'Cache-Control': 'private, no-store',
    })
    if (content.byteSize != null) headers.set('Content-Length', String(content.byteSize))
    return new NextResponse(content.stream, { status: 200, headers })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
