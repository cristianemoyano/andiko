import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { uploadCredentialsSchema, deleteCredentialsSchema } from '@/modules/afip/afip-credentials.schema'
import { getCredentialStatus, uploadCredentials, deleteCredentials } from '@/modules/afip/afip-credentials.service'
import { AFIP_ERROR_MAP } from '@/modules/afip/afip-http-errors'

function mapError(err: unknown) {
  if (err instanceof Error && err.message in AFIP_ERROR_MAP) {
    const [message, status] = AFIP_ERROR_MAP[err.message]
    return NextResponse.json({ error: message, code: err.message }, { status })
  }
  throw err
}

export const GET = withPermission('sales:read', async (_req, _ctx, session) => {
  const ctx = await makeTenantContext(session.user)
  const credentials = await getCredentialStatus(ctx)
  return NextResponse.json({ credentials })
})

export const PUT = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = uploadCredentialsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const status = await uploadCredentials(ctx.orgId, parsed.data, resolveActorId(session))
    return NextResponse.json(status, { status: 201 })
  } catch (err) { return mapError(err) }
})

export const DELETE = withPermission('sales:write', async (req, _ctx, session) => {
  const parsed = deleteCredentialsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    await deleteCredentials(ctx.orgId, parsed.data.environment, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
})
