import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const capabilities = await resolveCapabilities(session)
  return NextResponse.json({ capabilities })
}
