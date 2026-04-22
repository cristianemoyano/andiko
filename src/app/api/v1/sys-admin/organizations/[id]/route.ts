import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { organizationUpdateSchema } from '@/modules/auth/tenancy-admin.schema'
import {
  getOrganizationWithBranches,
  updateOrganization,
  deleteOrganization,
} from '@/modules/auth/tenancy-admin.service'

type P = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const payload = await getOrganizationWithBranches(id)
    return NextResponse.json(payload)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
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

  const parsed = organizationUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const org = await updateOrganization(id, parsed.data)
    return NextResponse.json(org)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORG_NOT_FOUND') {
        return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'ORG_SLUG_TAKEN') {
        return NextResponse.json({ error: 'Ese slug ya está en uso', code: 'DUPLICATE_SLUG' }, { status: 409 })
      }
    }
    throw err
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    await deleteOrganization(id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
