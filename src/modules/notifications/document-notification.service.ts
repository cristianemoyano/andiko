import 'server-only'
import type { TenantContext } from '@/lib/tenancy'
import { resolveDocument } from '@/modules/communications/document-resolver'
import {
  type EmailDocumentType,
  EMAIL_DOCUMENT_LABEL,
} from '@/modules/communications/email-template.schema'
import type { EmailLogStatus } from '@/modules/communications/email-log.model'
import { emitNotification } from './emit-notification.service'
import { documentSharedPayloadSchema } from './notification.schema'

/** email_logs.document_domain per document type (module that owns the record). */
const DOCUMENT_DOMAIN: Record<EmailDocumentType, 'sales' | 'inventory'> = {
  quote: 'sales',
  order: 'sales',
  invoice: 'sales',
  delivery_note: 'inventory',
}

export interface SendDocumentNotificationInput {
  documentType: EmailDocumentType
  documentId: string
  to: string
  subjectOverride?: string | null
  bodyOverride?: string | null
}

export interface SendDocumentNotificationResult {
  status: EmailLogStatus
  transport: 'smtp' | 'log'
  recipient: string
  subject: string
  log_id: string
  notification_id: string
}

/**
 * Share a sales/inventory document by email via the notifications pipeline.
 * Resolves the document (tenant-scoped), emits `sales.document.shared`, and
 * delivers through the email channel.
 */
export async function sendDocumentNotification(
  input: SendDocumentNotificationInput,
  ctx: TenantContext,
  actorId: string | null,
): Promise<SendDocumentNotificationResult> {
  const doc = await resolveDocument(input.documentType, input.documentId, ctx)

  const payload = documentSharedPayloadSchema.parse({
    document_type: input.documentType,
    document_id: input.documentId,
    document_domain: DOCUMENT_DOMAIN[input.documentType],
    document_number: doc.document_number,
    document_label: doc.document_label,
    contact_name: doc.contact_name,
    total: doc.total,
    org_name: doc.org_name,
    document_url: doc.document_url,
  })

  const result = await emitNotification(
    {
      eventKey: 'sales.document.shared',
      recipient: { kind: 'email', address: input.to },
      payload,
      channels: ['email'],
      subjectOverride: input.subjectOverride,
      bodyOverride: input.bodyOverride,
    },
    { orgId: ctx.orgId, actorId },
  )

  if (!result.subject || !result.recipient || !result.log_id) {
    throw new Error('EMAIL_SEND_FAILED')
  }

  return {
    status: result.status,
    transport: result.transport ?? 'log',
    recipient: result.recipient,
    subject: result.subject,
    log_id: result.log_id,
    notification_id: result.notification_id,
  }
}

export { EMAIL_DOCUMENT_LABEL }
