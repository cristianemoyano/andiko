import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { orgUserUpdateSchema } from '@/modules/auth/org-users.schema'
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

  const parsed = orgUserUpdateSchema.safeParse(json)
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
    await updateOrgUser(orgId, userId, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'USER_NOT_IN_ORG') {
        return NextResponse.json({ error: 'Usuario no encontrado en la organización', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'USER_NOT_EDITABLE') {
        return NextResponse.json({ error: 'Este usuario no se puede editar desde aquí', code: 'FORBIDDEN' }, { status: 403 })
      }
      if (err.message === 'BRANCH_NOT_IN_ORG') {
        return NextResponse.json(
          { error: 'Una o más sucursales no pertenecen a esta organización', code: 'VALIDATION_ERROR' },
          { status: 422 },
        )
      }
      if (err.message === 'DEFAULT_BRANCH_INVALID') {
        return NextResponse.json(
          { error: 'La sucursal por defecto debe estar entre las permitidas', code: 'VALIDATION_ERROR' },
          { status: 422 },
        )
      }
    }
    throw err
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId, userId } = await ctx.params
  try {
    await softDeleteOrgUser(orgId, userId)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'USER_NOT_IN_ORG') {
        return NextResponse.json({ error: 'Usuario no encontrado en la organización', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'USER_NOT_EDITABLE') {
        return NextResponse.json({ error: 'Este usuario no se puede eliminar desde aquí', code: 'FORBIDDEN' }, { status: 403 })
      }
    }
    throw err
  }
}
