import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can, type Permission } from '@/lib/permissions'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getEmailLog } from '@/modules/communications/email-logs.service'
import {
  EMAIL_DOCUMENT_TYPES,
  type EmailDocumentType,
} from '@/modules/communications/email-template.schema'
import type { AuthedSession } from '@/lib/api-handler'
import type { UserRole } from '@/types/roles'

const PERMISSION_BY_TYPE: Record<EmailDocumentType, Permission> = {
  quote: 'sales:read',
  order: 'sales:read',
  invoice: 'sales:read',
  delivery_note: 'inventory:read',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getAllowedDocumentTypes(role: UserRole, orgId?: string): Promise<EmailDocumentType[]> {
  const allowed: EmailDocumentType[] = []
  for (const type of EMAIL_DOCUMENT_TYPES) {
    if (await can(role, PERMISSION_BY_TYPE[type], orgId)) {
      allowed.push(type)
    }
  }
  return allowed
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const role = session.user.role as UserRole
  const orgId = session.user.orgId ?? undefined

  let ctx
  try {
    ctx = await makeTenantContext(session.user as AuthedSession['user'])
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json(
        { error: 'No hay organización en contexto.', code: TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED },
        { status: 422 },
      )
    }
    throw err
  }

  const allowedDocumentTypes = await getAllowedDocumentTypes(role, orgId)
  if (allowedDocumentTypes.length === 0) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const log = await getEmailLog(ctx.orgId, id, allowedDocumentTypes)
    return NextResponse.json({ log })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_LOG_NOT_FOUND') {
      return NextResponse.json({ error: 'Registro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
