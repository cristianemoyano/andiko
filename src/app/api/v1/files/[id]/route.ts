import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { getFile, deleteFile } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string }

export const GET = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    const result = await getFile(id, buildFileActor(session, tenant))
    return NextResponse.json(result)
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})

export const DELETE = withTenantAuth<P>(async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    await deleteFile(id, buildFileActor(session, tenant))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
