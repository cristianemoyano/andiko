import 'server-only'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/** Returns session when user is sys-admin; otherwise a JSON error response. */
export async function requireSysAdmin(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await auth()
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }) }
  }
  if (session.user.realRole !== 'sys-admin') {
    return { response: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }) }
  }
  return { session }
}
