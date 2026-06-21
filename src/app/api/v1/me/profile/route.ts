import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { getUserProfile, updateUserProfile } from '@/modules/auth/profile.service'
import { profileUpdateSchema } from '@/modules/auth/profile.schema'
import type { UserRole } from '@/types/roles'

const PROFILE_ERRORS: Record<string, { error: string; status: number }> = {
  NOT_FOUND: { error: 'Usuario no encontrado', status: 404 },
  NO_CHANGES: { error: 'No hay cambios para guardar', status: 422 },
  CURRENT_PASSWORD_REQUIRED: {
    error: 'Ingresá tu contraseña actual para cambiarla',
    status: 422,
  },
  CURRENT_PASSWORD_INVALID: { error: 'La contraseña actual no es correcta', status: 422 },
}

function profileError(code: string) {
  const mapped = PROFILE_ERRORS[code]
  if (!mapped) {
    return NextResponse.json({ error: 'Error interno', code: 'INTERNAL' }, { status: 500 })
  }
  return NextResponse.json({ error: mapped.error, code }, { status: mapped.status })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const userId = resolveActorId(session as AuthedSession)
  const profile = await getUserProfile(userId)
  if (!profile) {
    return profileError('NOT_FOUND')
  }

  return NextResponse.json({ profile })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const user = session.user as AuthedSession['user']
  const userId = resolveActorId(session as AuthedSession)

  try {
    const profile = await updateUserProfile(userId, parsed.data, {
      actorRealRole: user.realRole as UserRole,
      isImpersonating: !!user.impersonation,
    })
    return NextResponse.json({ profile })
  } catch (e) {
    const code = e instanceof Error ? e.message : 'INTERNAL'
    if (code in PROFILE_ERRORS) return profileError(code)
    throw e
  }
}
