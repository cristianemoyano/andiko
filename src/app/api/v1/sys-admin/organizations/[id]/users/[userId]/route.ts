import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { orgUserMutationErrorResponse } from '@/lib/org-users-api-errors'
import { parseOrgUserUpdateInput } from '@/modules/auth/org-users.schema'
import { softDeleteOrgUser, updateOrgUser } from '@/modules/auth/org-users.service'

type P = { id: string; userId: string }

export async function PATCH(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId, userId } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = parseOrgUserUpdateInput(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  try {
    await updateOrgUser(orgId, userId, parsed.data, {
      userId: gate.session.user.id!,
      bypassManagementRules: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const mapped = orgUserMutationErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId, userId } = await ctx.params
  try {
    await softDeleteOrgUser(orgId, userId, {
      userId: gate.session.user.id!,
      bypassManagementRules: true,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const mapped = orgUserMutationErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
