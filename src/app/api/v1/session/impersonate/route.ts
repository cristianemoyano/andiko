import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { isUuid, loadUserForImpersonation } from '@/modules/auth/impersonation.service'
import type { UserRole } from '@/types/roles'

const bodySchema = z.object({
  userId: z.string().uuid(),
})

/**
 * Pre-check before `update({ impersonation: { userId } })` (JWT re-loads the user from DB).
 * Returns 200 so the client can show a clear error without silent no-op.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
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
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { userId } = parsed.data
  if (!isUuid(userId)) {
    return NextResponse.json({ error: 'ID inválido', code: 'VALIDATION_ERROR' }, { status: 422 })
  }
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: 'No podés impersonarte a vos mismo', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const target = await loadUserForImpersonation(userId)
  if (!target) {
    return NextResponse.json(
      { error: 'Usuario no encontrado o inactivo', code: 'NOT_FOUND' },
      { status: 404 },
    )
  }
  if ((target.role as UserRole) === 'sys-admin') {
    return NextResponse.json(
      { error: 'No se puede impersonar a otro sys-admin', code: 'FORBIDDEN' },
      { status: 403 },
    )
  }

  return NextResponse.json({ ok: true as const, userId: target.id })
}
