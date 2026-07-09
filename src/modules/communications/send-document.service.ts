import 'server-only'
import type { TenantContext } from '@/lib/tenancy'
import type { EmailLogStatus } from './email-log.model'
import type { EmailDocumentType } from './email-template.schema'
import { sendDocumentNotification } from '@/modules/notifications/document-notification.service'

export interface SendDocumentEmailInput {
  documentType: EmailDocumentType
  documentId: string
  /** Recipient address. Required — the caller confirms/edits the contact's email. */
  to: string
  /** Optional subject/body overrides; when present they are still interpolated. */
  subjectOverride?: string | null
  bodyOverride?: string | null
}

export interface SendDocumentEmailResult {
  status: EmailLogStatus
  transport: 'smtp' | 'log'
  recipient: string
  subject: string
  log_id: string
}

/**
 * Resolve a document, render the configured email template (or the provided
 * overrides), send it through the notifications email channel (SMTP or log
 * transport when SMTP is not configured), and persist audit rows.
 *
 * A delivery failure is recorded and re-thrown as `EMAIL_SEND_FAILED` so the
 * route can surface it to the user.
 */
export async function sendDocumentEmail(
  input: SendDocumentEmailInput,
  ctx: TenantContext,
  actorId: string | null,
): Promise<SendDocumentEmailResult> {
  const result = await sendDocumentNotification(input, ctx, actorId)
  return {
    status: result.status,
    transport: result.transport,
    recipient: result.recipient,
    subject: result.subject,
    log_id: result.log_id,
  }
}
