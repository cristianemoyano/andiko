import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import Organization from '@/modules/auth/organization.model'

const bodySchema = z.object({
  organizationId: z.string().uuid().nullable(),
})

/**
 * Validates org exists before client calls `update({ actingOrgId })`.
 * Only sys-admin may set workspace context when they have no native org_id.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (session.user.realRole !== 'sys-admin') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const { organizationId } = parsed.data

  if (organizationId) {
    const org = await Organization.findByPk(organizationId)
    if (!org || !org.is_active) {
      return NextResponse.json({ error: 'Organización no encontrada o inactiva', code: 'NOT_FOUND' }, { status: 422 })
    }
  }

  return NextResponse.json({ ok: true, actingOrgId: organizationId })
}
