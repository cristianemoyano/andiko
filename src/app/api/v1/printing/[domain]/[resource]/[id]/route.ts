import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { resolveTenantContext } from '@/lib/tenancy'
import { getPrintHandler, resolvePrintableDocument } from '@/modules/printing'
import type { UserRole } from '@/types/roles'

type P = { domain: string; resource: string; id: string }

function isNotFoundMessage(msg: string): boolean {
  if (msg === 'NOT_FOUND' || msg === 'HANDLER_NOT_FOUND') return true
  return /_NOT_FOUND$/.test(msg)
}

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { domain, resource, id } = await ctx.params
  const handler = getPrintHandler(domain, resource)
  if (!handler) {
    return NextResponse.json(
      { error: 'Tipo de documento de impresión no reconocido', code: 'HANDLER_NOT_FOUND' },
      { status: 404 },
    )
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const role = session.user.role as UserRole
  if (!(await can(role, handler.permission, tenantResult.ctx.orgId))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const data = await resolvePrintableDocument(domain, resource, id, tenantResult.ctx)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (isNotFoundMessage(msg)) {
      return NextResponse.json({ error: 'Documento no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
