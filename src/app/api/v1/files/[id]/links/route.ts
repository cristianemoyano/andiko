import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { ownerLinkSchema } from '@/modules/storage/storage.schema'
import { addLink } from '@/modules/storage/storage.service'
import { buildFileActor, storageErrorResponse } from '@/modules/storage/storage.http'

type P = { id: string }

export const POST = withTenantAuth<P>(async (req, ctx, session, tenant) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = ownerLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  try {
    const link = await addLink(id, parsed.data, buildFileActor(session, tenant))
    return NextResponse.json(link, { status: 201 })
  } catch (err) {
    const resp = storageErrorResponse(err)
    if (resp) return resp
    throw err
  }
})
