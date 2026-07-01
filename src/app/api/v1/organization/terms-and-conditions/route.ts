import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { termsAndConditionsUpdateSchema } from '@/modules/auth/terms-and-conditions.schema'
import { getTermsAndConditions, updateTermsAndConditions } from '@/modules/auth/terms-and-conditions.service'

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  const result = await getTermsAndConditions(orgId)
  return NextResponse.json(result)
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = termsAndConditionsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const result = await updateTermsAndConditions(orgId, parsed.data.terms_and_conditions)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
