import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listActiveOrganizations } from '@/modules/auth/organizations.service'

/** List organizations for sys-admin workspace selection (assume identity). */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (session.user.realRole !== 'sys-admin') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const rows = await listActiveOrganizations()
  const data = rows.map(o => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
  }))
  return NextResponse.json({ data })
}
