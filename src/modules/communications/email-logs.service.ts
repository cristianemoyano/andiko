import 'server-only'
import EmailLog, { type EmailLogStatus } from './email-log.model'
import type { EmailDocumentType } from './email-template.schema'

const MAX_LOGS = 50

export interface EmailLogView {
  id: string
  recipient: string
  subject: string
  status: EmailLogStatus
  error: string | null
  sent_at: string
}

/** Send history for a single document, newest first. */
export async function listDocumentEmailLogs(
  orgId: string,
  documentType: EmailDocumentType,
  documentId: string,
): Promise<EmailLogView[]> {
  const rows = await EmailLog.findAll({
    where: { org_id: orgId, document_type: documentType, document_id: documentId },
    order: [['created_at', 'DESC']],
    limit: MAX_LOGS,
  })
  return rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.error,
    sent_at: r.created_at.toISOString(),
  }))
}
