import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { parseOrgUserCreateInput } from '@/modules/auth/org-users.schema'
import { createOrgUser, listOrgUsers } from '@/modules/auth/org-users.service'

type P = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId } = await ctx.params
  const data = await listOrgUsers(orgId)
  return NextResponse.json({ data })
}

export async function POST(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = parseOrgUserCreateInput(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const user = await createOrgUser(orgId, parsed.data)
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'EMAIL_TAKEN') {
        return NextResponse.json({ error: 'Ese email ya está registrado', code: 'DUPLICATE_EMAIL' }, { status: 409 })
      }
      if (err.message === 'BRANCH_NOT_IN_ORG') {
        return NextResponse.json(
          { error: 'Una o más sucursales no pertenecen a esta organización', code: 'VALIDATION_ERROR' },
          { status: 422 },
        )
      }
    }
    throw err
  }
}
