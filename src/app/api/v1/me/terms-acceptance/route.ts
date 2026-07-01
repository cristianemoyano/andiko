import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAuthedSession, resolveActorId } from '@/lib/api-handler'
import { hasAcceptedCurrentTerms, recordTermsAcceptance } from '@/modules/auth/terms-acceptance.service'
import { CURRENT_TERMS_VERSION } from '@/modules/auth/terms-of-service'

export async function GET() {
  const session = requireAuthedSession(await auth())
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const accepted = await hasAcceptedCurrentTerms(resolveActorId(session))
  return NextResponse.json({ accepted, current_version: CURRENT_TERMS_VERSION })
}

export async function POST(req: NextRequest) {
  const session = requireAuthedSession(await auth())
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (session.user.impersonation) {
    return NextResponse.json(
      {
        error: 'No se puede aceptar términos durante una impersonación',
        code: 'IMPERSONATION_FORBIDDEN',
      },
      { status: 403 },
    )
  }

  const forwardedFor = req.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null
  const userAgent = req.headers.get('user-agent')

  await recordTermsAcceptance(resolveActorId(session), { ipAddress, userAgent })

  return NextResponse.json({ accepted: true })
}
