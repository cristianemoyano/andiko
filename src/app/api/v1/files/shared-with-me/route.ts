import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { paginationSchema } from '@/lib/pagination'
import { listSharedWithMeFiles } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

/** Files explicitly shared with the caller (user, role, or branch) — no module permission required. */
export const GET = withTenantAuth(async (req, _ctx, session, tenant) => {
  const parsed = paginationSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result = await listSharedWithMeFiles(parsed.data, buildFileActor(session, tenant))
    return NextResponse.json(result)
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
