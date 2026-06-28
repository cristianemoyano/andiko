import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { initiateUploadSchema, fileListQuerySchema } from '@/modules/storage/storage.schema'
import { initiateUpload, listFiles } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

export const GET = withTenantAuth(async (req, _ctx, session, tenant) => {
  const parsed = fileListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result = await listFiles(parsed.data, buildFileActor(session, tenant))
    return NextResponse.json(result)
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})

export const POST = withTenantAuth(async (req, _ctx, session, tenant) => {
  const body = await req.json()
  const parsed = initiateUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  try {
    const result = await initiateUpload(parsed.data, buildFileActor(session, tenant))
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
