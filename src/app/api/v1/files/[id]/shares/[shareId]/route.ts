import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { unshareFile } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string; shareId: string }

export const DELETE = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id, shareId } = await ctx.params
  try {
    await unshareFile(id, shareId, buildFileActor(session, tenant))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
