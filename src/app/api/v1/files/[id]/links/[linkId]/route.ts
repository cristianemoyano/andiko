import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { removeLink } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string; linkId: string }

export const DELETE = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id, linkId } = await ctx.params
  try {
    await removeLink(id, linkId, buildFileActor(session, tenant))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
