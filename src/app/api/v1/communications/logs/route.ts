import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can, type Permission } from '@/lib/permissions'
import { resolveTenantContext } from '@/lib/tenancy'
import {
  listDocumentEmailLogs,
  listEmailLogs,
} from '@/modules/communications/email-logs.service'
import { emailLogListQuerySchema } from '@/modules/communications/email-logs.schema'
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
  purchase_order: 'purchases:read',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const role = session.user.role as UserRole
  const { searchParams } = new URL(req.url)
  const documentType = searchParams.get('document_type') ?? ''
  const documentId = searchParams.get('document_id') ?? ''

  const tenantResult = await resolveTenantContext(session.user as AuthedSession['user'])
  if ('error' in tenantResult) return tenantResult.error
  const orgId = tenantResult.ctx.orgId
  const ctx = tenantResult.ctx

  // Per-document history (SendDocumentEmail modal).
  if (documentType || documentId) {
    if (!EMAIL_DOCUMENT_TYPES.includes(documentType as EmailDocumentType) || !UUID.test(documentId)) {
      return NextResponse.json(
        { error: 'Parámetros inválidos: document_type y document_id son obligatorios', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    const type = documentType as EmailDocumentType
    if (!(await can(role, PERMISSION_BY_TYPE[type], orgId))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }
    const logs = await listDocumentEmailLogs(ctx.orgId, type, documentId)
    return NextResponse.json({ logs })
  }

  // Org-wide audit list — settings admin only.
  if (!(await can(role, 'settings:read', orgId, session.user.orgRoleId ?? null))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const parsed = emailLogListQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const allowedDocumentTypes = EMAIL_DOCUMENT_TYPES.filter(t =>
    parsed.data.document_type ? t === parsed.data.document_type : true,
  )

  const result = await listEmailLogs(ctx.orgId, {
    ...parsed.data,
    allowedDocumentTypes,
  })
  return NextResponse.json(result)
}
