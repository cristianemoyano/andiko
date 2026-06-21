import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const path = await resolvePostAuthRedirect(session)
  return NextResponse.json({ path })
}
