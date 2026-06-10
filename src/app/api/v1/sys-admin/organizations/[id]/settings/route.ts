import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { organizationSettingsUpdateSchema } from '@/modules/auth/tenancy-admin.schema'
import { getEffectiveOrganizationSettings, updateOrganizationSettings } from '@/modules/auth/organization-settings.service'

type P = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const settings = await getEffectiveOrganizationSettings(id)
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = organizationSettingsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const settings = await updateOrganizationSettings(id, parsed.data)
    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
