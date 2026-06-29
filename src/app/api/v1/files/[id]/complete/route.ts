import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { completeUpload } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string }

export const POST = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    const file = await completeUpload(id, buildFileActor(session, tenant))
    return NextResponse.json(file.toJSON())
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
