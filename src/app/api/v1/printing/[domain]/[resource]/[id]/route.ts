import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getPrintHandler, resolvePrintableDocument } from '@/modules/printing'
import type { UserRole } from '@/types/roles'

type P = { domain: string; resource: string; id: string }

const ORG_REQUIRED = {
  error: 'No hay organización en contexto.',
  code:  TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED,
} as const

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

  const role  = session.user.role as UserRole
  const orgId = session.user.orgId ?? undefined
  if (!(await can(role, handler.permission, orgId))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  let tenantCtx
  try {
    tenantCtx = await makeTenantContext(session.user)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json(ORG_REQUIRED, { status: 422 })
    }
    throw err
  }

  try {
    const data = await resolvePrintableDocument(domain, resource, id, tenantCtx)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (isNotFoundMessage(msg)) {
      return NextResponse.json({ error: 'Documento no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
