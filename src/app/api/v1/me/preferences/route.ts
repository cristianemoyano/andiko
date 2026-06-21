import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { getUserPreferences, updateUserPreferences } from '@/modules/auth/user-preferences.service'
import { userPreferencesPatchSchema } from '@/modules/auth/user-preferences.schema'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const userId = resolveActorId(session as AuthedSession)
  const preferences = await getUserPreferences(userId)

  return NextResponse.json({ preferences })
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

  const parsed = userPreferencesPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const userId = resolveActorId(session as AuthedSession)
  const preferences = await updateUserPreferences(userId, parsed.data)

  return NextResponse.json({ preferences })
}
