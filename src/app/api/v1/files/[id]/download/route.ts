import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { getDownloadUrl } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string }

export const GET = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    const result = await getDownloadUrl(id, buildFileActor(session, tenant))
    return NextResponse.json(result)
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
