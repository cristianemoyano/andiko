import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { can, type Permission } from '@/lib/permissions'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { sendDocumentEmail } from '@/modules/communications/send-document.service'
import { EMAIL_DOCUMENT_TYPES, type EmailDocumentType } from '@/modules/communications/email-template.schema'
import type { UserRole } from '@/types/roles'

/** Read permission required to email each document type. */
const PERMISSION_BY_TYPE: Record<EmailDocumentType, Permission> = {
  quote: 'sales:read',
  order: 'sales:read',
  invoice: 'sales:read',
  delivery_note: 'inventory:read',
  purchase_order: 'purchases:read',
}

const sendSchema = z.object({
  document_type: z.enum(EMAIL_DOCUMENT_TYPES),
  document_id: z.string().uuid(),
  to: z.string().email('Dirección de correo inválida').max(320),
  subject: z.string().max(500).optional(),
  body: z.string().max(20_000).optional(),
})

function isNotFoundMessage(msg: string): boolean {
  return msg === 'NOT_FOUND' || /_NOT_FOUND$/.test(msg)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }
  const { document_type, document_id, to, subject, body } = parsed.data

  const role = session.user.role as UserRole
  const tenantResult = await resolveTenantContext(session.user as AuthedSession['user'])
  if ('error' in tenantResult) return tenantResult.error
  const orgId = tenantResult.ctx.orgId

  if (!(await can(role, PERMISSION_BY_TYPE[document_type], orgId))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const ctx = tenantResult.ctx

  try {
    const result = await sendDocumentEmail(
      {
        documentType: document_type,
        documentId: document_id,
        to,
        subjectOverride: subject ?? null,
        bodyOverride: body ?? null,
      },
      ctx,
      resolveActorId(session as AuthedSession),
    )
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (isNotFoundMessage(msg)) {
      return NextResponse.json({ error: 'Documento no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (msg === 'EMAIL_SEND_FAILED') {
      const detail = (err as Error & { detail?: string }).detail
      return NextResponse.json(
        { error: `No se pudo enviar el email: ${detail ?? 'error de envío'}`, code: 'EMAIL_SEND_FAILED' },
        { status: 502 },
      )
    }
    throw err
  }
}
